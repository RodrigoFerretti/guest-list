import { type Ctx, cleanName, error, json, nameKey, now, readJson, requireRole } from "../_lib";

const MAX_NAMES = 500;

// Admin: importa vários nomes de uma vez (um por linha na interface). Duplicados são ignorados.
export const onRequestPost = async (ctx: Ctx) => {
  const denied = requireRole(ctx, "admin");
  if (denied) return denied;
  const body = await readJson<{ names?: unknown }>(ctx.request);
  if (!Array.isArray(body?.names)) return error(400, "invalid_body", "Envie { names: [...] }.");
  if (body.names.length > MAX_NAMES) return error(400, "too_many", `No máximo ${MAX_NAMES} nomes por vez.`);

  const seen = new Set<string>();
  const names: string[] = [];
  let invalid = 0;
  for (const raw of body.names) {
    const name = cleanName(raw);
    if (!name) {
      if (typeof raw === "string" && raw.trim() === "") continue;
      invalid++;
      continue;
    }
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  if (names.length === 0) return json({ added: 0, skipped: 0, invalid });

  const ts = now();
  const by = ctx.data.auth!.label;
  const stmt = ctx.env.DB.prepare(
    "INSERT OR IGNORE INTO guests (name, name_key, added_by, added_at) VALUES (?, ?, ?, ?)",
  );
  const results = await ctx.env.DB.batch(names.map((n) => stmt.bind(n, nameKey(n), by, ts)));
  const added = results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
  return json({ added, skipped: names.length - added, invalid });
};
