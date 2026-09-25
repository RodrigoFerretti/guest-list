import { type Ctx, json } from "../_lib";

export const onRequestGet = async (ctx: Ctx) =>
  json({ user: ctx.data.auth!.user, role: ctx.data.auth!.role, label: ctx.data.auth!.label });
