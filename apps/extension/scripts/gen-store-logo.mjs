// Generates the 300x300 store logo for Edge Add-ons / Chrome Web Store listings.
// Same indigo rounded-square + white waveform mark as the toolbar icons; the
// renderer + PNG encoder are shared via icon-mark.mjs so the logo can't drift
// from the icon. Run: node scripts/gen-store-logo.mjs  → apps/extension/store/logo-300.png
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodePng, render } from "./icon-mark.mjs";

const SIZE = 300;

const outDir = join(process.cwd(), "store");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "logo-300.png"), encodePng(SIZE, render(SIZE)));
console.log(`[gen-store-logo] wrote ${SIZE}x${SIZE} store logo to store/logo-300.png`);
