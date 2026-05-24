// Copies ONNX Runtime Web's wasm/mjs out of @huggingface/transformers into the
// extension's public/ort dir so they're served from the extension origin.
// MV3 CSP (script-src 'self') blocks importing these from the jsDelivr CDN.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function findDist() {
  try {
    return join(dirname(require.resolve("@huggingface/transformers/package.json")), "dist");
  } catch {
    /* fall through */
  }
  let dir = dirname(require.resolve("@huggingface/transformers"));
  for (let i = 0; i < 4; i++) {
    if (existsSync(dir) && readdirSync(dir).some((f) => /^ort-.*\.wasm$/.test(f))) return dir;
    dir = dirname(dir);
  }
  return dir;
}

const dist = findDist();
const out = join(process.cwd(), "public", "ort");
mkdirSync(out, { recursive: true });

let n = 0;
for (const f of readdirSync(dist)) {
  if (/^ort-.*\.(mjs|wasm)$/.test(f)) {
    copyFileSync(join(dist, f), join(out, f));
    n++;
  }
}
console.log(`[copy-ort] copied ${n} ONNX Runtime file(s) to public/ort (from ${dist})`);
