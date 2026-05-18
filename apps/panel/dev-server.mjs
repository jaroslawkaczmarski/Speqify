// Dev launcher: run Vite with cwd = this app dir (pnpm's script shell hangs
// on this machine, so we bypass it via node — same pattern as the landing).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
process.chdir(root);

const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
});
await server.listen();
server.printUrls();
