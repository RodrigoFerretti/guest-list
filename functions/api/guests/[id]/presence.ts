import { type Ctx, GUEST_COLUMNS, type GuestRow, error, json, now, readJson } from "../../../_lib";

// Host e admin: marca ou desmarca a chegada. Grava o estado atual no convidado
// e uma linha no histórico (checkins), na mesma transação.
export const onRequestPost = async (ctx: Ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return error(400, "invalid_id");
  const body = await readJson<{ present?: unknown }>(ctx.request);
  if (typeof body?.present !== "boolean") return error(400, "invalid_body", "Campo 'present' deve ser true ou false.");
  const present = body.present ? 1 : 0;

  const guest = await ctx.env.DB.prepare("SELECT id, present FROM guests WHERE id = ? AND removed_at IS NULL")
    .bind(id)
    .first<{ id: number; present: number }>();
  if (!guest) return error(404, "not_found", "Convidado não encontrado.");

  const ts = now();
  const by = ctx.data.auth!.label;
  if (guest.present !== present) {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        "UPDATE guests SET present = ?, present_changed_at = ?, present_changed_by = ? WHERE id = ?",
      ).bind(present, ts, by, id),
      ctx.env.DB.prepare(
        "INSERT INTO checkins (guest_id, present, changed_by, changed_at) VALUES (?, ?, ?, ?)",
      ).bind(id, present, by, ts),
    ]);
  }
  const updated = await ctx.env.DB.prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`).bind(id).first<GuestRow>();
  return json({ guest: updated });
};
