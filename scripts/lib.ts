// Funções usadas pelos scripts de setup, deploy, links, rotate, import e dev.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import QRCode from "qrcode";

export const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
export const WRANGLER_BIN = `${ROOT}/node_modules/.bin/wrangler`;

export interface Config {
  slug: string;
  title: string;
  language: string;
  adminPassword: string;
  hostPassword: string;
}

export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export function loadConfig(): Config {
  const path = `${ROOT}/config.yaml`;
  if (!existsSync(path)) fail("config.yaml não encontrado. Copie config.example.yaml para config.yaml e edite.");
  const raw = parse(readFileSync(path, "utf8")) ?? {};
  const slug = String(raw.slug ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const language = String(raw.language ?? "pt-BR").trim() || "pt-BR";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(slug)) {
    fail(`slug inválido: "${slug}". Use só letras minúsculas, números e hífens (até 58 caracteres).`);
  }
  if (!title) fail("title vazio em config.yaml.");
  const adminPassword = String(raw.admin_password ?? "");
  const hostPassword = String(raw.host_password ?? "");
  for (const [key, value] of [["admin_password", adminPassword], ["host_password", hostPassword]] as const) {
    if (value.length < 6) fail(`${key} precisa ter pelo menos 6 caracteres (config.yaml).`);
    if (value === "troque-esta-senha" || value === "outra-senha") fail(`${key} ainda é o exemplo; escolha uma senha (config.yaml).`);
  }
  if (adminPassword === hostPassword) fail("admin_password e host_password precisam ser diferentes.");
  return { slug, title, language, adminPassword, hostPassword };
}

export const dbName = (slug: string) => `guest-list-${slug}`;
export const siteUrl = (slug: string) => `https://${slug}.pages.dev`;

export function wrangler(args: string[], opts: { capture?: boolean; allowFail?: boolean } = {}): string {
  const result = spawnSync(WRANGLER_BIN, args, {
    cwd: ROOT,
    stdio: opts.capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
  });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !opts.allowFail) {
    if (opts.capture) console.error(out);
    fail(`wrangler ${args.join(" ")} falhou (código ${result.status}).`);
  }
  return out;
}

// Pega o JSON de uma saída do wrangler, ignorando avisos impressos antes ou depois.
export function extractJson<T>(out: string): T {
  const start = Math.min(...["[", "{"].map((c) => out.indexOf(c)).filter((i) => i >= 0));
  const end = Math.max(out.lastIndexOf("]"), out.lastIndexOf("}"));
  if (!Number.isFinite(start) || end < start) fail(`saída inesperada do wrangler:\n${out}`);
  return JSON.parse(out.slice(start, end + 1)) as T;
}

export function ensureDatabase(slug: string): string {
  const name = dbName(slug);
  const find = () => {
    const list = extractJson<Array<{ uuid: string; name: string }>>(wrangler(["d1", "list", "--json"], { capture: true }));
    return list.find((d) => d.name === name)?.uuid;
  };
  let id = find();
  if (!id) {
    console.log(`→ criando banco D1 "${name}"`);
    wrangler(["d1", "create", name]);
    id = find();
  } else {
    console.log(`→ banco D1 "${name}" já existe`);
  }
  if (!id) fail("não consegui descobrir o id do banco D1.");
  return id;
}

export function writeWranglerConfig(config: Config, databaseId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const jsonc = `// Gerado por "bun run setup" a partir de config.yaml. Não versionar.
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": ${JSON.stringify(config.slug)},
  "pages_build_output_dir": "./public",
  "compatibility_date": ${JSON.stringify(today)},
  "vars": {
    "TITLE": ${JSON.stringify(config.title)},
    "LANGUAGE": ${JSON.stringify(config.language)},
    "ADMIN_PASSWORD_HASH": ${JSON.stringify(sha256Hex(`admin:${config.adminPassword}`))},
    "HOST_PASSWORD_HASH": ${JSON.stringify(sha256Hex(`porta:${config.hostPassword}`))}
  },
  "d1_databases": [
    { "binding": "DB", "database_name": ${JSON.stringify(dbName(config.slug))}, "database_id": ${JSON.stringify(databaseId)} }
  ]
}
`;
  writeFileSync(`${ROOT}/wrangler.jsonc`, jsonc);
  console.log("→ wrangler.jsonc gerado");
}

export function applySchema(slug: string, where: "remote" | "local"): void {
  console.log(`→ aplicando schema.sql (${where})`);
  wrangler(["d1", "execute", dbName(slug), `--${where}`, "--file", "schema.sql", "--yes"], { capture: true });
}

export function execSql(slug: string, where: "remote" | "local", sql: string): unknown {
  const out = wrangler(["d1", "execute", dbName(slug), `--${where}`, "--command", sql, "--json", "--yes"], {
    capture: true,
  });
  return extractJson<unknown>(out);
}

export function ensurePagesProject(slug: string): void {
  const out = wrangler(["pages", "project", "create", slug, "--production-branch", "main"], {
    capture: true,
    allowFail: true,
  });
  if (/already exists|8000007/i.test(out)) console.log(`→ projeto Pages "${slug}" já existe`);
  else if (/Successfully created/i.test(out)) console.log(`→ projeto Pages "${slug}" criado`);
  else fail(`não consegui criar o projeto Pages:\n${out}`);
}

export const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex");

// Imprime o endereço com QR code (só o endereço; as senhas ficam no config.yaml).
export async function printAccess(base: string, config: Config): Promise<void> {
  console.log(`\n══════ ${config.title} ══════`);
  console.log(base);
  console.log(await QRCode.toString(base, { type: "terminal", small: true }));
  const png = `${ROOT}/qr-code.png`;
  await QRCode.toFile(png, base, { width: 512, margin: 2 });
  console.log(`(QR code do endereço salvo em qr-code.png)`);
  console.log("\nUsuários: \"admin\" (organizador) e \"porta\" (quem recebe os convidados). As senhas são as do config.yaml.");
  console.log("Passe para a pessoa da porta o endereço e a senha de porta. A senha de admin fica só com você.\n");
}
