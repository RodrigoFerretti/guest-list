// bun run deploy: publica a pasta public/ e as functions/ no Cloudflare Pages (as senhas do config.yaml valem a partir daqui).
import { existsSync, readFileSync } from "node:fs";
import { ROOT, fail, loadConfig, printAccess, siteUrl, wrangler, writeWranglerConfig } from "./lib";

const config = loadConfig();
if (!existsSync(`${ROOT}/wrangler.jsonc`)) fail("wrangler.jsonc não existe. Rode antes: bun run setup");
// Regenera o wrangler.jsonc para que título e senhas alterados no config.yaml sejam publicados.
const current = readFileSync(`${ROOT}/wrangler.jsonc`, "utf8");
const id = /"database_id":\s*"([^"]+)"/.exec(current)?.[1];
if (!id) fail("wrangler.jsonc sem database_id. Rode de novo: bun run setup");
writeWranglerConfig(config, id);
wrangler(["pages", "deploy", "--project-name", config.slug, "--branch", "main", "--commit-dirty=true"]);
console.log(`\n✔ Publicado em ${siteUrl(config.slug)} (título e senhas novos valem em até um minuto)\n`);
await printAccess(siteUrl(config.slug), config);
