import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Marketing site — static build to Workers Static Assets. Lean JS for CWV
// (DESIGN.md principle 10: performance is a design decision).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
});
