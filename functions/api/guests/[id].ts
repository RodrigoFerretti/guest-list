import { type Ctx, error, json, now, requireRole } from "../../_lib";

// Admin: remoção lógica. O histórico de check-ins é preservado.
export const onRequestDelete = async (ctx: Ctx) => {
  const denied = requireRole(ctx, "admin");
  if (denied) return denied;
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return error(400, "invalid_id");
  const res = await ctx.env.DB.prepare("UPDATE guests SET removed_at = ? WHERE id = ? AND removed_at IS NULL")
    .bind(now(), id)
    .run();
  if (res.meta.changes === 0) return error(404, "not_found", "Convidado não encontrado.");
  return json({ ok: true });
};
