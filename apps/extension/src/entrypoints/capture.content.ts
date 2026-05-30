import { defineContentScript, browser } from "#imports";
import {
  CAPTURE_SOURCE,
  type AreaRect,
  type CaptureMessage,
  type ContentRequest,
  type LiveClickMessage,
} from "@/messaging";
import type {
  ConsoleEntry,
  ElementInfo,
  JsErrorEntry,
  NetworkEntry,
  PageInfo,
  ReproStep,
} from "@speqify/core";

const MAX = 100;

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const consoleBuf: ConsoleEntry[] = [];
    const networkBuf: NetworkEntry[] = [];
    const errorBuf: JsErrorEntry[] = [];
    let stepBuf: ReproStep[] = [];

    /** True between START_CAPTURE and END_CAPTURE. */
    let capturing = false;
    let trackSteps = false;

    const push = <T>(buf: T[], entry: T) => {
      buf.push(entry);
      if (buf.length > MAX) buf.shift();
    };

    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window) return;
      const data = e.data as CaptureMessage | undefined;
      if (!data || data.source !== CAPTURE_SOURCE) return;
      if (data.kind === "console") push(consoleBuf, data.entry);
      else if (data.kind === "network") push(networkBuf, data.entry);
      else if (data.kind === "error") push(errorBuf, data.entry);
    });

    const pageInfo = (): PageInfo => ({
      url: location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    });

    // ── Reproduction-step + live-cursor capture ────────────────────────────
    const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

    const onClick = (e: MouseEvent) => {
      if (!capturing) return;
      // Live ring for the canvas recorder (cheap; panel decides whether to draw).
      const live: LiveClickMessage = { type: "SPEQIFY_LIVE_CLICK", x: e.clientX, y: e.clientY, viewport: viewport() };
      void browser.runtime.sendMessage(live).catch(() => {});
      if (!trackSteps) return;
      const el = e.target as Element | null;
      if (!el) return;
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      push(stepBuf, { kind: "click", at: Date.now(), target: cssPath(el), text: text || undefined });
    };

    const onChange = (e: Event) => {
      if (!capturing || !trackSteps) return;
      const el = e.target as (HTMLInputElement | HTMLTextAreaElement) & { type?: string };
      if (!el || !("value" in el)) return;
      const isSecret = el.type === "password";
      const value = isSecret ? "•••" : String(el.value ?? "").slice(0, 60);
      push(stepBuf, { kind: "input", at: Date.now(), target: cssPath(el), value: value || undefined });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!capturing || !trackSteps) return;
      if (e.key === "Enter" || e.key === "Escape" || e.key === "Tab") {
        push(stepBuf, { kind: "key", at: Date.now(), key: e.key });
      }
    };

    const onNav = () => {
      if (!capturing || !trackSteps) return;
      push(stepBuf, { kind: "nav", at: Date.now(), url: location.href });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);

    browser.runtime.onMessage.addListener(
      (msg: ContentRequest, _sender, sendResponse: (r: unknown) => void) => {
        if (msg.type === "SPEQIFY_START_CAPTURE") {
          stepBuf = [];
          trackSteps = msg.trackSteps;
          capturing = true;
          sendResponse({ ok: true });
          return false;
        }
        if (msg.type === "SPEQIFY_END_CAPTURE") {
          capturing = false;
          sendResponse({ ok: true });
          return false;
        }
        if (msg.type === "SPEQIFY_GET_CONTEXT") {
          sendResponse({
            page: pageInfo(),
            console: [...consoleBuf],
            network: [...networkBuf],
            errors: [...errorBuf],
            steps: [...stepBuf],
          });
          return false;
        }
        if (msg.type === "SPEQIFY_PICK_ELEMENT") {
          pickElement().then((element) => sendResponse({ element, viewport: viewport() }));
          return true; // async
        }
        if (msg.type === "SPEQIFY_PICK_AREA") {
          pickArea().then((rect) => sendResponse({ rect, viewport: viewport() }));
          return true; // async
        }
        return false;
      },
    );
  },
});

function cssPath(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 6) {
    const current: Element = node;
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    let sel = current.nodeName.toLowerCase();
    const parentEl = current.parentElement;
    if (parentEl) {
      const sameTag = Array.from(parentEl.children).filter(
        (c) => c.nodeName === current.nodeName,
      );
      if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
    }
    parts.unshift(sel);
    node = parentEl;
  }
  return parts.join(" > ");
}

function toElementInfo(el: Element): ElementInfo {
  const r = el.getBoundingClientRect();
  return {
    selector: cssPath(el),
    html: el.outerHTML.slice(0, 2000),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
  };
}

function pickElement(): Promise<ElementInfo | null> {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #6d5efc;background:rgba(109,94,252,.15);border-radius:4px;transition:all .04s ease;";
    const hint = document.createElement("div");
    hint.textContent = "Click an element · Esc to cancel";
    hint.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#15131f;color:#fff;font:600 12px/1.4 system-ui,sans-serif;padding:6px 12px;border-radius:999px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.4);";
    document.documentElement.append(box, hint);

    let current: Element | null = null;
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === box || el === hint) return;
      current = el;
      const r = el.getBoundingClientRect();
      box.style.left = `${r.left}px`;
      box.style.top = `${r.top}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
    };
    const cleanup = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      box.remove();
      hint.remove();
    };
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = current;
      cleanup();
      resolve(el ? toElementInfo(el) : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  });
}

/** Drag a rectangle over the page; resolves the selected viewport region in CSS px. */
function pickArea(): Promise<AreaRect | null> {
  return new Promise((resolve) => {
    const veil = document.createElement("div");
    veil.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(21,19,31,.25);";
    const rectEl = document.createElement("div");
    rectEl.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #6d5efc;background:rgba(109,94,252,.12);box-shadow:0 0 0 100vmax rgba(21,19,31,.25);display:none;";
    const hint = document.createElement("div");
    hint.textContent = "Drag to select an area · Esc to cancel";
    hint.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#15131f;color:#fff;font:600 12px/1.4 system-ui,sans-serif;padding:6px 12px;border-radius:999px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.4);";
    document.documentElement.append(veil, rectEl, hint);

    let sx = 0;
    let sy = 0;
    let dragging = false;

    const geom = (e: MouseEvent): AreaRect => {
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      return { x, y, w: Math.abs(e.clientX - sx), h: Math.abs(e.clientY - sy) };
    };
    const cleanup = () => {
      veil.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      document.removeEventListener("keydown", onKey, true);
      veil.remove();
      rectEl.remove();
      hint.remove();
    };
    const onDown = (e: MouseEvent) => {
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      rectEl.style.display = "block";
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const g = geom(e);
      rectEl.style.left = `${g.x}px`;
      rectEl.style.top = `${g.y}px`;
      rectEl.style.width = `${g.w}px`;
      rectEl.style.height = `${g.h}px`;
    };
    const onUp = (e: MouseEvent) => {
      if (!dragging) return;
      const g = geom(e);
      cleanup();
      resolve(g.w > 8 && g.h > 8 ? g : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };
    veil.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    document.addEventListener("keydown", onKey, true);
  });
}
