/**
 * Rebuild the SDK loader IIFE bundle and copy it to the landing app's public
 * dir so `/(landing)/sdk-demo.html` always serves the current overlay code.
 *
 * Replaces the manual `esbuild … && cp …` step. Run: `pnpm sdk:demo`
 * (or `node scripts/sdk-demo.mjs`). esbuild is resolved from @speqify/sdk's
 * own devDependency, so no root-level install is required.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const require = createRequire(join(root, "packages/sdk/package.json"));
const esbuild = require("esbuild");

const outfile = join(root, "apps/landing/public/speqify-loader.js");

await esbuild.build({
  entryPoints: [join(root, "packages/sdk/src/loader.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile,
  logLevel: "info",
});

console.log(
  `speqify-loader.js rebuilt → ${outfile.replace(root + "\\", "").replace(root + "/", "")}`,
);
