import { type Ctx, json } from "../_lib";

// Público: o título aparece antes do login.
export const onRequestGet = async (ctx: Ctx) =>
  json({ title: ctx.env.TITLE ?? "Lista de convidados", language: ctx.env.LANGUAGE ?? "pt-BR" });
