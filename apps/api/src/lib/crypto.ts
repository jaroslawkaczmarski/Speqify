/**
 * Web Crypto helpers (run in both `workerd` and Node 22 — no Node-only APIs).
 * Used for SuperAdmin/PO password hashing and signed session tokens (§9, §11).
 */
const enc = new TextEncoder();

function toBytes(s: string): Uint8Array {
  return enc.encode(s);
}

export function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function ub64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Constant-time comparison — avoids leaking match position via timing. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", toBytes(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = ub64url(parts[2] ?? "");
  const expected = ub64url(parts[3] ?? "");
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const key = await crypto.subtle.importKey("raw", toBytes(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      expected.length * 8,
    ),
  );
  return timingSafeEqual(bits, expected);
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, toBytes(message)));
}

export interface SessionClaims {
  sub: string;
  role: string;
  /** Unix seconds. */
  exp: number;
}

export async function issueSession(secret: string, claims: SessionClaims): Promise<string> {
  const payload = b64url(toBytes(JSON.stringify(claims)));
  const sig = b64url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifySession(secret: string, token: string): Promise<SessionClaims | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(await hmac(secret, payload));
  if (!timingSafeEqual(toBytes(sig), toBytes(expected))) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(ub64url(payload))) as SessionClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
