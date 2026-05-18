import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve Tailwind's config explicitly so it works regardless of process cwd
// (the dev server / build runs node directly from the repo root).
const here = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: resolve(here, "tailwind.config.ts") },
    autoprefixer: {},
  },
};
