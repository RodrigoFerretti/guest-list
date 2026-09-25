// bun run links: imprime de novo o endereço e o QR code.
import { loadConfig, printAccess, siteUrl } from "./lib";

const config = loadConfig();
await printAccess(process.argv[2] ?? siteUrl(config.slug), config);
