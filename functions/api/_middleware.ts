import { type Ctx, USERS, error, sha256Hex } from "../_lib";

const PUBLIC_PATHS = new Set(["/api/config"]);

// Toda rota /api/* exige usuário e senha no cabeçalho Authorization (HTTP Basic).
// A senha nunca viaja na URL, então não aparece em histórico nem em logs de acesso.
// No servidor só existem os hashes SHA-256, gerados por "bun run setup" a partir do config.yaml.
export const onRequest = async (ctx: Ctx) => {
  const url = new URL(ctx.request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return ctx.next();

  const header = ctx.request.headers.get("authorization") ?? "";
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/.exec(header);
  if (!match) return error(401, "unauthorized");
  let decoded = "";
  try {
    decoded = atob(match[1]);
  } catch {
    return error(401, "unauthorized");
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return error(401, "unauthorized");
  const user = decoded.slice(0, sep).trim().toLowerCase();
  const password = decoded.slice(sep + 1);
  const entry = USERS[user];
  const expected = entry ? ctx.env[entry.hashVar] : undefined;
  if (!entry || !expected || password.length === 0) return error(401, "unauthorized");
  if ((await sha256Hex(`${user}:${password}`)) !== expected) return error(401, "unauthorized");

  ctx.data.auth = { user, role: entry.role, label: entry.label };
  return ctx.next();
};
