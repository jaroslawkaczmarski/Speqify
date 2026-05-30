import type { CaptureContext, Ticket } from "@speqify/core";

/**
 * A paused capture the user can resume later. Stored in IndexedDB (not
 * chrome.storage) because it holds the recorded video Blob, which is too large
 * for chrome.storage.local's quota.
 */
export interface DraftRecord {
  id: string;
  createdAt: number;
  title: string;
  ticket: Ticket;
  context?: CaptureContext;
  transcript: string;
  /** The recorded screen+voice webm, if any. */
  video: Blob | null;
}

const DB_NAME = "speqify";
const STORE = "drafts";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const store = db.transaction(STORE, mode).objectStore(STORE);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function newDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `d_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
}

export async function saveDraft(rec: DraftRecord): Promise<void> {
  await tx("readwrite", (s) => s.put(rec));
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const all = await tx<DraftRecord[]>("readonly", (s) => s.getAll() as IDBRequest<DraftRecord[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteDraft(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}
