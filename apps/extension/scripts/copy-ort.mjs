// Copies ONNX Runtime Web's wasm/mjs into the extension's public/ort dir so they're
// served from the extension origin. The MV3 CSP (script-src 'self') blocks ORT's
// default jsDelivr CDN, so the runtime must be same-origin.
//
// NOTE: transformers v4 keeps the .wasm in the `onnxruntime-web` dependency (its own
// dist only ships a .mjs loader), so we resolve onnxruntime-web *relative to
// transformers* to grab the exact version it uses. We resolve package MAIN entries,
// never "<pkg>/package.json" — that subpath is blocked by modern "exports" maps.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

// transformers v4 picks a build per browser: `asyncify` (Chromium) and the plain
// build (Safari). Ship both; skip the jsep/jspi variants v4's web build doesn't use.
const WANT = /^ort-wasm-simd-threaded(\.asyncify)?\.(mjs|wasm)$/;

function hasOrt(dir) {
  return existsSync(dir) && readdirSync(dir).some((f) => WANT.test(f));
}

function findOrtDist() {
  const candidates = [];
  // 1) onnxruntime-web resolved relative to transformers (the version v4 loads).
  try {
    const tfDir = dirname(require.resolve("@huggingface/transformers"));
    candidates.push(dirname(require.resolve("onnxruntime-web", { paths: [tfDir] })));
  } catch {
    /* ignore */
  }
  // 2) onnxruntime-web resolved directly.
  try {
    candidates.push(dirname(require.resolve("onnxruntime-web")));
  } catch {
    /* ignore */
  }
  // The resolved main entry may sit at the package root or inside dist/ — check both.
  for (const base of candidates) {
    for (const dir of [base, join(base, "dist")]) {
      if (hasOrt(dir)) return dir;
    }
  }
  return null;
}

const dist = findOrtDist();
const out = join(process.cwd(), "public", "ort");
// Start clean so a runtime upgrade can't leave a stale (unused) wasm behind.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let n = 0;
if (dist) {
  for (const f of readdirSync(dist)) {
    if (WANT.test(f)) {
      copyFileSync(join(dist, f), join(out, f));
      n++;
    }
  }
}
if (n === 0) {
  // Fail loud: a silent 0-copy means on-device models can't load under the MV3 CSP.
  throw new Error(`[copy-ort] copied 0 ONNX Runtime files (dist=${dist}). On-device AI cannot load under the MV3 CSP without these.`);
}
console.log(`[copy-ort] copied ${n} ONNX Runtime file(s) to public/ort (from ${dist})`);
