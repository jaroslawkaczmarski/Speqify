/**
 * Element screenshot via html2canvas, lazy-loaded from a CDN at capture time
 * so the loader bundle stays tiny (no build-time dependency). The host app's
 * CSP must allow the script + connect (our own apps, documented in §7).
 */
type Html2Canvas = (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

const DEFAULT_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

let loading: Promise<Html2Canvas> | null = null;

function getGlobal(): Html2Canvas | undefined {
  return (globalThis as unknown as { html2canvas?: Html2Canvas }).html2canvas;
}

function loadHtml2Canvas(url: string): Promise<Html2Canvas> {
  const existing = getGlobal();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<Html2Canvas>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      const fn = getGlobal();
      if (fn) resolve(fn);
      else reject(new Error("html2canvas unavailable after load"));
    };
    s.onerror = () => reject(new Error("Failed to load html2canvas"));
    document.head.appendChild(s);
  });
  return loading;
}

export async function captureScreenshot(
  el: Element | null,
  url: string = DEFAULT_URL,
): Promise<Blob> {
  const h2c = await loadHtml2Canvas(url);
  const target = (el as HTMLElement | null) ?? document.body;
  const canvas = await h2c(target, {
    logging: false,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Screenshot encode failed"))),
      "image/png",
    );
  });
}
