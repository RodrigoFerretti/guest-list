import { type Ctx, GUEST_COLUMNS, type GuestRow, requireRole } from "../_lib";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Admin: exporta a lista como CSV (com BOM para abrir direto no Excel).
export const onRequestGet = async (ctx: Ctx) => {
  const denied = requireRole(ctx, "admin");
  if (denied) return denied;
  const { results } = await ctx.env.DB.prepare(
    `SELECT ${GUEST_COLUMNS} FROM guests WHERE removed_at IS NULL ORDER BY name COLLATE NOCASE`,
  ).all<GuestRow>();
  const header = ["name", "note", "present", "present_changed_at", "present_changed_by", "added_by", "added_at"];
  const lines = [header.join(",")];
  for (const g of results) {
    lines.push(
      [g.name, g.note, g.present ? "x" : "", g.present_changed_at, g.present_changed_by, g.added_by, g.added_at]
        .map(csvCell)
        .join(","),
    );
  }
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="convidados-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
};
