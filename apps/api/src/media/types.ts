/**
 * Object storage port. Handlers depend on this, not on R2 — so upload/serve
 * flows are unit-testable with the in-memory adapter (no Cloudflare in CI).
 */
export interface StoredMedia {
  body: ArrayBuffer;
  contentType: string;
}

export interface MediaStore {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredMedia | null>;
}

export const MEDIA_LIMITS: Record<string, number> = {
  screenshot: 12 * 1024 * 1024,
  voice: 30 * 1024 * 1024,
  "recording-video": 256 * 1024 * 1024,
  "recording-audio": 30 * 1024 * 1024,
};
