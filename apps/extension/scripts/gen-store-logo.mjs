// Generates the 300x300 store logo for Edge Add-ons / Chrome Web Store listings.
// Same indigo rounded-square + white waveform mark as the toolbar icons
// (scripts/gen-icons.mjs), rendered larger. Pure Node — hand-rolled PNG encoder.
// Output: apps/extension/store/logo-300.png  (run: node scripts/gen-store-logo.mjs)
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SIZE = 300;
const INDIGO = [79, 70, 229]; // #4F46E5
const WHITE = [255, 255, 255];

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Waveform bars in a 32-unit grid (matches the wordmark mark): [centerX, yTop, yBottom]
const BARS = [
  [9, 16, 16],
  [13, 12, 20],
  [17, 9, 23],
  [21, 13, 19],
  [25, 16, 16],
];

function render(size) {
  const s = size / 32;
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const halfBar = Math.max(1, 1.1 * s);
  const dotR = Math.max(1, 1.4 * s);

  const put = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  };
  const inRoundRect = (x, y) => {
    const r = radius;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r + 0.5;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundRect(x + 0.5, y + 0.5)) continue;
      let color = INDIGO;
      const px = x + 0.5;
      const py = y + 0.5;
      for (const [ux, y0, y1] of BARS) {
        const bx = ux * s;
        if (y0 === y1) {
          if (Math.hypot(px - bx, py - 16 * s) <= dotR) {
            color = WHITE;
            break;
          }
        } else if (Math.abs(px - bx) <= halfBar && py >= y0 * s && py <= y1 * s) {
          color = WHITE;
          break;
        }
      }
      put(x, y, color);
    }
  }
  return rgba;
}

const outDir = join(process.cwd(), "store");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "logo-300.png"), encodePng(SIZE, render(SIZE)));
console.log(`[gen-store-logo] wrote ${SIZE}x${SIZE} store logo to store/logo-300.png`);
