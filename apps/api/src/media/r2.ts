import type { MediaStore, StoredMedia } from "./types.js";

/** R2-backed MediaStore (runtime adapter). Mirrors InMemoryMediaStore. */
export class R2MediaStore implements MediaStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
    await this.bucket.put(key, body, { httpMetadata: { contentType } });
  }

  async get(key: string): Promise<StoredMedia | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return {
      body: await obj.arrayBuffer(),
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }
}
