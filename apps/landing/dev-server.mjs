// Dev launcher: run Vite with cwd = this app dir so Tailwind's relative
// `content` globs resolve correctly. (pnpm's script shell hangs on this
// machine — see IMPLEMENTATION_PLAN notes — so we bypass it via node.)
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
