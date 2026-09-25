import { type Ctx, GUEST_COLUMNS, type GuestRow, cleanName, error, json, nameKey, now, readJson, requireRole } from "../../_lib";

export const onRequestGet = async (ctx: Ctx) => {
  const { results } = await ctx.env.DB.prepare(
    `SELECT ${GUEST_COLUMNS} FROM guests WHERE removed_at IS NULL ORDER BY name COLLATE NOCASE`,
  ).all<GuestRow>();
  return json({ guests: results, role: ctx.data.auth!.role });
};

// Admin: adiciona um convidado. 409 se já existe.
export const onRequestPost = async (ctx: Ctx) => {
  const denied = requireRole(ctx, "admin");
  if (denied) return denied;
  const body = await readJson<{ name?: unknown; note?: unknown }>(ctx.request);
  const name = cleanName(body?.name);
  if (!name) return error(400, "invalid_name", "Informe o nome do convidado.");
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  const key = nameKey(name);

  const existing = await ctx.env.DB.prepare("SELECT id, removed_at FROM guests WHERE name_key = ?")
    .bind(key)
    .first<{ id: number; removed_at: string | null }>();
  if (existing && !existing.removed_at) return error(409, "duplicate", "Convidado já existe.");

  const ts = now();
  const by = ctx.data.auth!.label;
  let id: number;
  if (existing) {
    // Reativa um convidado removido em vez de criar outro com a mesma chave.
    await ctx.env.DB.prepare(
      "UPDATE guests SET name = ?, note = ?, removed_at = NULL, present = 0, present_changed_at = NULL, present_changed_by = NULL, added_by = ?, added_at = ? WHERE id = ?",
    )
      .bind(name, note, by, ts, existing.id)
      .run();
    id = existing.id;
  } else {
    const res = await ctx.env.DB.prepare(
      "INSERT INTO guests (name, name_key, note, added_by, added_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(name, key, note, by, ts)
      .run();
    id = Number(res.meta.last_row_id);
  }
  const guest = await ctx.env.DB.prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`).bind(id).first<GuestRow>();
  return json({ guest }, 201);
};
