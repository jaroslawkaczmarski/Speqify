/**
 * Screenshot redaction (§9/§14: hide PII before it leaves the browser).
 * Rectangles are in the image's natural pixel space, so the result is
 * correct regardless of DPR / display scaling.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pure: clamp rects into [0,width]x[0,height], drop empty. Unit-tested. */
export function clampRects(rects: readonly Rect[], width: number, height: number): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    const x1 = Math.max(0, Math.min(r.x, width));
    const y1 = Math.max(0, Math.min(r.y, height));
    const x2 = Math.max(0, Math.min(r.x + r.w, width));
    const y2 = Math.max(0, Math.min(r.y + r.h, height));
    const w = x2 - x1;
    const h = y2 - y1;
    if (w > 0 && h > 0) out.push({ x: x1, y: y1, w, h });
  }
  return out;
}

/** Paint solid-black boxes over `rects` and re-encode as PNG. */
export async function redactBlob(blob: Blob, rects: readonly Rect[]): Promise<Blob> {
  if (rects.length === 0) return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  ctx.fillStyle = "#000";
  for (const r of clampRects(rects, bitmap.width, bitmap.height)) {
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  bitmap.close();
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? blob), "image/png");
  });
}
