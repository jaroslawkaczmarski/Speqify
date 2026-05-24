import { defineContentScript, browser } from "#imports";
import { CAPTURE_SOURCE, type CaptureMessage, type ContentRequest } from "@/messaging";
import type {
  ConsoleEntry,
  ElementInfo,
  JsErrorEntry,
  NetworkEntry,
  PageInfo,
} from "@speqify/core";

const MAX = 100;

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const consoleBuf: ConsoleEntry[] = [];
    const networkBuf: NetworkEntry[] = [];
    const errorBuf: JsErrorEntry[] = [];

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

    browser.runtime.onMessage.addListener(
      (msg: ContentRequest, _sender, sendResponse: (r: unknown) => void) => {
        if (msg.type === "SPEQIFY_GET_CONTEXT") {
          sendResponse({
            page: pageInfo(),
            console: [...consoleBuf],
            network: [...networkBuf],
            errors: [...errorBuf],
          });
          return false;
        }
        if (msg.type === "SPEQIFY_PICK_ELEMENT") {
          pickElement().then((element) => sendResponse({ element }));
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
