/**
 * Pure data-minimisation helpers (§9, §14). All captured content is untrusted
 * and may contain secrets/PII — bound size and strip credentials BEFORE it
 * ever leaves the browser. Unit-tested, DOM-free.
 */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "proxy-authorization",
]);

const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._-]+/gi,
  /\beyJ[A-Za-z0-9._-]{20,}/g, // JWT-ish
  /\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[=:]\s*[^\s&"']+/gi,
  /\b[A-Za-z0-9_-]{32,}\b/g, // long opaque tokens
];

/** Redact secret-looking substrings from a free string. */
export function scrubString(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[redacted]");
  return out;
}

/** Drop sensitive headers; redact the rest. */
export function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase())) continue;
    out[k] = scrubString(v);
  }
  return out;
}

/** Strip query string + redact the path (tokens are often in URLs). */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "http://x");
    return scrubString(`${u.origin === "http://x" ? "" : u.origin}${u.pathname}`);
  } catch {
    return scrubString(url.split("?")[0] ?? url);
  }
}

/** Keep only the last `max` items (ring buffer semantics). */
export function capArray<T>(arr: readonly T[], max: number): T[] {
  return arr.length <= max ? arr.slice() : arr.slice(arr.length - max);
}

/** Truncate a string to `max` chars with an ellipsis marker. */
export function capString(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…[+${s.length - max}]`;
}
