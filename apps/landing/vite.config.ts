import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Bundle the workspace UI package into the SSR build used for prerendering
  // (it ships TS source, not a built dist).
  ssr: { noExternal: ["@speqify/ui"] },
});
