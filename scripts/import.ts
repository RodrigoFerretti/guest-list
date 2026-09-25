// bun run import <arquivo>: importa nomes (um por linha, ou a coluna "guest"/"nome"/"name" de um CSV).
import { readFileSync } from "node:fs";
import { execSql, fail, loadConfig } from "./lib";

const file = process.argv[2];
const where = process.argv.includes("--local") ? "local" : "remote";
if (!file) fail("uso: bun run import lista.txt   (ou lista.csv) [--local]");
const config = loadConfig();

const lines = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/);
let column = 0;
let start = 0;
const header = (lines[0] ?? "").split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
const idx = header.findIndex((h) => ["guest", "nome", "name", "convidado"].includes(h));
if (idx >= 0) {
  column = idx;
  start = 1;
}
const nameKey = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const seen = new Set<string>();
const names: string[] = [];
for (const line of lines.slice(start)) {
  const cell = (line.split(",")[column] ?? "").trim().replace(/^"|"$/g, "").replace(/\s+/g, " ");
  if (!cell || cell.length > 120) continue;
  const key = nameKey(cell);
  if (seen.has(key)) continue;
  seen.add(key);
  names.push(cell);
}
if (names.length === 0) fail("nenhum nome encontrado no arquivo.");

const ts = new Date().toISOString();
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
let added = 0;
for (let i = 0; i < names.length; i += 100) {
  const chunk = names.slice(i, i + 100);
  const sql = chunk
    .map((n) => `INSERT OR IGNORE INTO guests (name, name_key, added_by, added_at) VALUES (${q(n)}, ${q(nameKey(n))}, 'import', '${ts}')`)
    .join("; ");
  const res = execSql(config.slug, where, sql) as Array<{ meta?: { changes?: number } }>;
  added += res.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
}
console.log(`\n✔ ${added} nome(s) adicionado(s), ${names.length - added} já existiam (${where}).\n`);
