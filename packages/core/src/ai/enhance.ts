import type { CaptureContext } from "../capture.js";
import { AiError } from "./types.js";

/**
 * Build a compact, model-friendly digest of the page context captured during a
 * recording. The extension's AI layer (local or remote) prepends this to the
 * spoken note so the model can write a precise ticket without dumping raw logs.
 */
export function buildContextDigest(ctx?: CaptureContext): string {
  if (!ctx) return "";
  const lines: string[] = [];
  lines.push(`Page: ${ctx.page.title || "(untitled)"} — ${ctx.page.url}`);
  if (ctx.element) lines.push(`Selected element: ${ctx.element.selector}`);
  const errors = ctx.errors.slice(-8);
  if (errors.length) {
    lines.push("JS errors:");
    for (const e of errors) lines.push(`  - ${e.message}`);
  }
  const consoleErrors = ctx.console
    .filter((c) => c.level === "error" || c.level === "warn")
    .slice(-8);
  if (consoleErrors.length) {
    lines.push("Console:");
    for (const c of consoleErrors) lines.push(`  - [${c.level}] ${c.message}`);
  }
  const failed = ctx.network.filter((n) => !n.ok).slice(-8);
  if (failed.length) {
    lines.push("Failed network requests:");
    for (const n of failed) lines.push(`  - ${n.status} ${n.method} ${n.url}`);
  }
  const steps = (ctx.steps ?? []).slice(-12);
  if (steps.length) {
    lines.push("Reproduction steps (observed):");
    for (const s of steps) lines.push(`  - ${describeStep(s)}`);
  }
  return lines.join("\n");
}

/** One-line, human-readable summary of a recorded interaction step. */
export function describeStep(s: import("../capture.js").ReproStep): string {
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
