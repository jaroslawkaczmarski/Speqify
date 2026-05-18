import type { MediaStore, StoredMedia } from "./types.js";

/** In-memory MediaStore — unit tests and local dev without R2. */
export class InMemoryMediaStore implements MediaStore {
  private items = new Map<string, StoredMedia>();

  async put(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
    this.items.set(key, { body, contentType });
  }

  async get(key: string): Promise<StoredMedia | null> {
    return this.items.get(key) ?? null;
  }
}
