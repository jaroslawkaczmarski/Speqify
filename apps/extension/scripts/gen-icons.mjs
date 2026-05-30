// Generates Speqify toolbar icons (indigo rounded square + white waveform) as PNGs.
// The PNG encoder + mark geometry live in icon-mark.mjs (shared with gen-store-logo.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodePng, render } from "./icon-mark.mjs";

const SIZES = [16, 32, 48, 96, 128];

const outDir = join(process.cwd(), "public", "icon");
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(outDir, `${size}.png`), encodePng(size, render(size)));
}
console.log(`[gen-icons] wrote ${SIZES.length} icons to public/icon`);
