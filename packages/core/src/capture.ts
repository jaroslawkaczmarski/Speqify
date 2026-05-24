/**
 * Context captured from the page the user is filing a ticket about.
 * Produced by the extension's content scripts; consumed by the AI enhance step
 * and embedded into the submitted ticket as a technical footer.
 */

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleEntry {
  level: ConsoleLevel;
  message: string;
  /** epoch ms */
  at: number;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  ok: boolean;
  /** epoch ms */
  at: number;
}

export interface JsErrorEntry {
  message: string;
  stack?: string;
  /** epoch ms */
  at: number;
}

export interface ElementInfo {
  selector: string;
  /** outerHTML, truncated */
  html: string;
  rect?: { x: number; y: number; w: number; h: number };
}

export interface PageInfo {
  url: string;
  title: string;
  userAgent: string;
  viewport: { w: number; h: number; dpr: number };
}

export interface CaptureContext {
  page: PageInfo;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  errors: JsErrorEntry[];
  element?: ElementInfo;
  /** PNG/JPEG data URL from chrome.tabs.captureVisibleTab */
  screenshot?: string;
}

export function emptyContext(page: PageInfo): CaptureContext {
  return { page, console: [], network: [], errors: [] };
}

/** True when there's anything worth showing/sending. */
export function hasSignal(ctx: CaptureContext | undefined): boolean {
  if (!ctx) return false;
  return Boolean(
    ctx.console.length ||
      ctx.network.length ||
      ctx.errors.length ||
      ctx.element ||
      ctx.screenshot,
  );
}
