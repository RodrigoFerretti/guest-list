// Utilitários compartilhados pelas Pages Functions.

export interface Env {
  DB: D1Database;
  TITLE?: string;
  LANGUAGE?: string;
  ADMIN_PASSWORD_HASH?: string;
  HOST_PASSWORD_HASH?: string;
}

export type Role = "admin" | "host";

// Usuários fixos: "admin" (organizador) e "porta" (quem recebe os convidados).
export const USERS: Record<string, { role: Role; label: string; hashVar: "ADMIN_PASSWORD_HASH" | "HOST_PASSWORD_HASH" }> = {
  admin: { role: "admin", label: "admin", hashVar: "ADMIN_PASSWORD_HASH" },
  porta: { role: "host", label: "porta", hashVar: "HOST_PASSWORD_HASH" },
};

export interface Auth {
  user: string;
  role: Role;
  label: string;
}

export interface Data {
  auth?: Auth;
  [key: string]: unknown;
}

export type Ctx = EventContext<Env, string, Data>;

export interface GuestRow {
  id: number;
  name: string;
  note: string | null;
  present: number;
  present_changed_at: string | null;
  present_changed_by: string | null;
  added_by: string;
  added_at: string;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function error(status: number, code: string, message?: string): Response {
  return json({ error: code, message }, status);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Chave de nome: sem acentos, minúscula, espaços colapsados. Evita "João Silva" e "joao silva" duplicados.
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 120) return null;
  return name;
}

export function now(): string {
  return new Date().toISOString();
}

export function requireRole(ctx: Ctx, role: Role): Response | null {
  const auth = ctx.data.auth;
  if (!auth) return error(401, "unauthorized");
  if (role === "admin" && auth.role !== "admin") return error(403, "forbidden", "Apenas o administrador pode fazer isso.");
  return null;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export const GUEST_COLUMNS =
  "id, name, note, present, present_changed_at, present_changed_by, added_by, added_at";
