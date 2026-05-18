/** IndexedDB-backed OutboxStore (falls back to in-memory if IDB is absent). */
import type { OutboxRecord, OutboxStore } from "./outbox.js";

const DB_NAME = "speqify";
const STORE = "outbox";

function memoryStore(): OutboxStore {
  const m = new Map<string, OutboxRecord>();
  return {
    put: async (r) => void m.set(r.payload.clientAnnotationId, r),
    getAll: async () => [...m.values()],
    del: async (id) => void m.delete(id),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "payload.clientAnnotationId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export function createOutboxStore(): OutboxStore {
  if (typeof indexedDB === "undefined") return memoryStore();
  return {
    async put(record) {
      const db = await openDb();
      await promisify(db.transaction(STORE, "readwrite").objectStore(STORE).put(record));
      db.close();
    },
    async getAll() {
      const db = await openDb();
      const all = await promisify(
        db.transaction(STORE, "readonly").objectStore(STORE).getAll() as IDBRequest<OutboxRecord[]>,
      );
      db.close();
      return all;
    },
    async del(id) {
      const db = await openDb();
      await promisify(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
      db.close();
    },
  };
}
