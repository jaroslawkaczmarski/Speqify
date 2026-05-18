import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SuperAdmin + Product Owner SPA — deployed to Workers Static Assets (Phase 2/3).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
});
