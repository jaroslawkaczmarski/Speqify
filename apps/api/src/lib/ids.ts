import { b64url } from "./crypto.js";

/** Primary keys — UUID v4. */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Panel capability token: 256 bits of CSPRNG, URL-safe. High entropy so it is
 * unguessable; revoked by deleting the panel row (§9, §14).
 */
export function newSecretToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}
