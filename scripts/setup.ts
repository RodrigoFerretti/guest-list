// bun run setup: lê config.yaml, cria banco e projeto no Cloudflare e gera wrangler.jsonc (com os hashes das senhas).
import { applySchema, ensureDatabase, ensurePagesProject, loadConfig, printAccess, siteUrl, writeWranglerConfig } from "./lib";

const config = loadConfig();
console.log(`\nConfigurando "${config.title}" → ${siteUrl(config.slug)}\n`);
const databaseId = ensureDatabase(config.slug);
writeWranglerConfig(config, databaseId);
applySchema(config.slug, "remote");
ensurePagesProject(config.slug);
console.log("\n✔ Pronto. Agora rode: bun run deploy\n");
