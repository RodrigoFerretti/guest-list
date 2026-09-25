// bun run dev: servidor local com banco D1 local (não toca no Cloudflare).
import { existsSync } from "node:fs";
import { ROOT, applySchema, fail, loadConfig, wrangler } from "./lib";

const config = loadConfig();
if (!existsSync(`${ROOT}/wrangler.jsonc`)) fail("wrangler.jsonc não existe. Rode antes: bun run setup");
applySchema(config.slug, "local");
const port = process.env.PORT ?? "8788";
console.log(`\nhttp://localhost:${port}  (usuários: admin e porta, senhas do config.yaml)\n`);
wrangler(["pages", "dev", "--port", port, "--ip", "127.0.0.1"]);
