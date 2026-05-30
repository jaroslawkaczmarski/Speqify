import type { CaptureContext, ConsoleLevel, ReproStep } from "../capture.js";
import { redactUrl, scrubSecrets } from "../redact.js";
import { AiError } from "./types.js";

/** Max entries kept per group when summarizing captured context (one shared cap). */
const CONTEXT_CAP = 10;

export interface ContextHighlights {
  /** Page URL with query/fragment stripped. */
  pageUrl: string;
  element?: string;
  jsErrors: { message: string; stack?: string }[];
  consoleErrors: { level: ConsoleLevel; message: string }[];
  failedRequests: { status: number; method: string; url: string }[];
  steps: ReproStep[];
}

/**
 * Single source of truth for which captured context to surface, WITH redaction
 * (URL query strings stripped, token shapes scrubbed) and one shared cap + rule.
 * Used by the AI digest and every tracker formatter so they never diverge.
 */
export function selectContextHighlights(ctx: CaptureContext): ContextHighlights {
  return {
    pageUrl: redactUrl(ctx.page.url),
    element: ctx.element?.selector,
    jsErrors: ctx.errors.slice(-CONTEXT_CAP).map((e) => ({
      message: scrubSecrets(e.message),
      stack: e.stack ? scrubSecrets(e.stack) : undefined,
    })),
    consoleErrors: ctx.console
      .filter((c) => c.level === "error" || c.level === "warn")
      .slice(-CONTEXT_CAP)
      .map((c) => ({ level: c.level, message: scrubSecrets(c.message) })),
    failedRequests: ctx.network
      .filter((n) => !n.ok)
      .slice(-CONTEXT_CAP)
      .map((n) => ({ status: n.status, method: n.method, url: redactUrl(n.url) })),
    steps: (ctx.steps ?? []).slice(-CONTEXT_CAP),
  };
}

/**
 * Build a compact, model-friendly digest of the page context captured during a
 * recording. The extension's AI layer (local or remote) prepends this to the
 * spoken note so the model can write a precise ticket without dumping raw logs.
 */
export function buildContextDigest(ctx?: CaptureContext): string {
  if (!ctx) return "";
  const h = selectContextHighlights(ctx);
  const lines: string[] = [`Page: ${ctx.page.title || "(untitled)"} — ${h.pageUrl}`];
  if (h.element) lines.push(`Selected element: ${h.element}`);
  if (h.jsErrors.length) {
    lines.push("JS errors:");
    for (const e of h.jsErrors) lines.push(`  - ${e.message}`);
  }
  if (h.consoleErrors.length) {
    lines.push("Console:");
    for (const c of h.consoleErrors) lines.push(`  - [${c.level}] ${c.message}`);
  }
  if (h.failedRequests.length) {
    lines.push("Failed network requests:");
    for (const n of h.failedRequests) lines.push(`  - ${n.status} ${n.method} ${n.url}`);
  }
  if (h.steps.length) {
    lines.push("Reproduction steps (observed):");
    for (const s of h.steps) lines.push(`  - ${describeStep(s)}`);
  }
  return lines.join("\n");
}

/** One-line, human-readable summary of a recorded interaction step. */
export function describeStep(s: ReproStep): string {
  switch (s.kind) {
    case "click":
      return `Click ${s.target}${s.text ? ` ("${s.text}")` : ""}`;
    case "input":
      return `Type into ${s.target}${s.value ? ` ("${s.value}")` : ""}`;
    case "nav":
      return `Navigate to ${s.url}`;
    case "key":
      return `Press ${s.key}`;
    case "scroll":
      return `Scroll to ${s.y}px`;
  }
}

/** Extract a JSON object from a model reply that may be fenced or padded with prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  // Fast path: the whole thing parses.
  try {
    return JSON.parse(candidate);
  } catch {
    /* fall through */
  }
  // Small models often emit the object then trailing junk (or a second object).
  // Pull out the FIRST balanced {...} object, ignoring braces inside strings.
  const obj = firstJsonObject(candidate);
  if (obj) {
    try {
      return JSON.parse(obj);
    } catch {
      /* fall through */
    }
  }
  throw new AiError("AI did not return valid JSON");
}

/** Return the first complete, brace-balanced JSON object substring, or null. */
function firstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
