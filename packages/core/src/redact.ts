/**
 * Best-effort redaction for captured page context before it leaves the browser
 * (sent to the AI endpoint and pasted into tracker issues). Not a guarantee —
 * a defense-in-depth pass that strips the most common token/secret shapes and
 * URL query strings (which frequently carry session tokens).
 */

/** Strip the query string + fragment from a URL — they often carry tokens. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.replace(/[?#].*$/, "");
  }
}

// Common API-token / credential shapes. Intentionally conservative (no email/PII
// scrubbing) to avoid mangling useful debugging text.
const SECRET_PATTERNS: RegExp[] = [
  /\b[sprk]k-[A-Za-z0-9_-]{16,}\b/g, // OpenAI / Stripe-style (sk-, pk-, rk-)
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens (ghp_, gho_, ghs_, ...)
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /\b(?:Bearer|token|api[_-]?key)\s*[:=]?\s*[A-Za-z0-9._-]{16,}/gi, // labelled secrets
];

/** Replace common secret/token shapes in free text with «redacted». */
export function scrubSecrets(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "«redacted»");
  return out;
}

/** True for an https URL (or http only to localhost) — vet user/tracker endpoints
 *  before attaching a token/PAT or POSTing captured context to them. */
export function isSafeEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:") return isLocalHost(u.hostname);
    return false;
  } catch {
    return false;
  }
}

/** True when the URL points at the local machine (a local model server, etc.). */
export function isLocalEndpoint(url: string): boolean {
  try {
    return isLocalHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}
