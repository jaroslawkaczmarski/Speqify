import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Explicit Tailwind config path — robust regardless of process cwd.
const here = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: resolve(here, "tailwind.config.ts") },
    autoprefixer: {},
  },
};
