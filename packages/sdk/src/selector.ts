/** Element capture: a reasonably stable CSS selector + XPath + outerHTML. */
import type { ElementCapture } from "./payload.js";

const MAX_HTML = 20_000;

function nth(el: Element): number {
  let i = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) i++;
    sib = sib.previousElementSibling;
  }
  return i;
}

export function cssSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-speqify-id");
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;

  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && node.tagName !== "HTML" && depth < 6) {
    const tag = node.tagName.toLowerCase();
    const part = node.id ? `#${CSS.escape(node.id)}` : `${tag}:nth-of-type(${nth(node)})`;
    parts.unshift(part);
    if (node.id) break;
    node = node.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

export function xpath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node.tagName !== "HTML") {
    parts.unshift(`${node.tagName.toLowerCase()}[${nth(node)}]`);
    node = node.parentElement;
  }
  return `/html/${parts.join("/")}`;
}

export function captureElement(el: Element): ElementCapture {
  const r = el.getBoundingClientRect();
  return {
    selector: cssSelector(el),
    xpath: xpath(el),
    html: el.outerHTML.slice(0, MAX_HTML),
    boundingBox: {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
  };
}
