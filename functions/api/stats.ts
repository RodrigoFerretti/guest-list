import { type Ctx, json, requireRole } from "../_lib";

// Admin: totais e histórico de chegadas (o navegador agrupa por hora local).
export const onRequestGet = async (ctx: Ctx) => {
  const denied = requireRole(ctx, "admin");
  if (denied) return denied;
  const totals = await ctx.env.DB.prepare(
    "SELECT COUNT(*) AS total, SUM(present) AS present FROM guests WHERE removed_at IS NULL",
  ).first<{ total: number; present: number | null }>();
  const { results: checkins } = await ctx.env.DB.prepare(
    "SELECT c.changed_at, c.present, c.changed_by FROM checkins c ORDER BY c.id DESC LIMIT 5000",
  ).all<{ changed_at: string; present: number; changed_by: string }>();
  const total = totals?.total ?? 0;
  const present = totals?.present ?? 0;
  return json({ total, present, absent: total - present, checkins: checkins.reverse() });
};
