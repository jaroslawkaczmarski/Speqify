/**
 * Offline-resilient send (§14, correctness-critical). Failed annotation
 * creates are persisted and retried with capped exponential backoff. Safe
 * because the server is idempotent on `clientAnnotationId` — re-sending a
 * queued item never duplicates.
 *
 * Pure + store/clock are injected, so the whole policy is unit-tested
 * without a browser. `idb.ts` provides the real IndexedDB-backed store.
 */
import type { CreateAnnotationInput } from "@speqify/shared";

export interface OutboxRecord {
  payload: CreateAnnotationInput;
  attempts: number;
  /** Earliest unix-ms at which this may be retried. */
  nextAt: number;
}

export interface OutboxStore {
  put(record: OutboxRecord): Promise<void>;
  getAll(): Promise<OutboxRecord[]>;
  del(clientAnnotationId: string): Promise<void>;
}

export type SendFn = (payload: CreateAnnotationInput) => Promise<unknown>;

const MAX_ATTEMPTS = 8;
const MAX_QUEUE = 200;

/** Capped exponential backoff: 2^n seconds, ceiling 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, 5 * 60 * 1000);
}

export class Outbox {
  constructor(
    private readonly store: OutboxStore,
    private readonly now: () => number = Date.now,
    private readonly maxQueue: number = MAX_QUEUE,
  ) {}

  /** Try to send now; queue on failure. Returns the outcome. */
  async send(payload: CreateAnnotationInput, send: SendFn): Promise<"sent" | "queued"> {
    try {
      await send(payload);
      return "sent";
    } catch {
      await this.enqueue(payload);
      return "queued";
    }
  }

  private async enqueue(payload: CreateAnnotationInput): Promise<void> {
    const all = await this.store.getAll();
    if (all.length >= this.maxQueue) {
      const oldest = all.reduce((a, b) => (a.nextAt <= b.nextAt ? a : b));
      await this.store.del(oldest.payload.clientAnnotationId);
    }
    await this.store.put({ payload, attempts: 0, nextAt: 0 });
  }

  /** Retry everything due. Returns counts for diagnostics/UI. */
  async flush(send: SendFn): Promise<{ sent: number; kept: number; dropped: number }> {
    const all = await this.store.getAll();
    let sent = 0;
    let kept = 0;
    let dropped = 0;
    for (const r of all) {
      if (this.now() < r.nextAt) {
        kept++;
        continue;
      }
      try {
        await send(r.payload);
        await this.store.del(r.payload.clientAnnotationId);
        sent++;
      } catch {
        const attempts = r.attempts + 1;
        if (attempts > MAX_ATTEMPTS) {
          await this.store.del(r.payload.clientAnnotationId);
          dropped++;
        } else {
          await this.store.put({
            payload: r.payload,
            attempts,
            nextAt: this.now() + backoffMs(attempts),
          });
          kept++;
        }
      }
    }
    return { sent, kept, dropped };
  }

  async size(): Promise<number> {
    return (await this.store.getAll()).length;
  }
}
