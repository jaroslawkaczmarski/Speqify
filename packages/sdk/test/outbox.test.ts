import type { CreateAnnotationInput } from "@speqify/shared";
import { describe, expect, it } from "vitest";
import { backoffMs, Outbox, type OutboxRecord, type OutboxStore } from "../src/outbox.js";
import { buildAnnotationPayload } from "../src/payload.js";

function memStore(): OutboxStore {
  const m = new Map<string, OutboxRecord>();
  return {
    put: async (r) => void m.set(r.payload.clientAnnotationId, r),
    getAll: async () => [...m.values()],
    del: async (id) => void m.delete(id),
  };
}

function payload(id: string): CreateAnnotationInput {
  return {
    ...buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/",
    }),
    clientAnnotationId: id,
  };
}

describe("backoffMs", () => {
  it("is exponential and capped at 5 minutes", () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(5 * 60 * 1000);
    expect(backoffMs(2)).toBeGreaterThan(backoffMs(1));
  });
});

describe("Outbox", () => {
  it("sends immediately when online, nothing queued", async () => {
    const ob = new Outbox(memStore());
    const r = await ob.send(payload("a"), async () => undefined);
    expect(r).toBe("sent");
    expect(await ob.size()).toBe(0);
  });

  it("queues on failure and retries with backoff until it succeeds", async () => {
    let t = 0;
    const ob = new Outbox(memStore(), () => t);
    let attempts = 0;
    const sender = async () => {
      attempts++;
      if (attempts <= 2) throw new Error("offline");
    };

    expect(await ob.send(payload("x"), sender)).toBe("queued");
    expect(await ob.size()).toBe(1);

    // First flush fails -> kept, scheduled into the future.
    expect(await ob.flush(sender)).toMatchObject({ sent: 0, kept: 1 });
    // Too early -> skipped, still kept.
    expect(await ob.flush(sender)).toMatchObject({ sent: 0, kept: 1 });
    // Advance past backoff -> succeeds, drained.
    t = 10 * 60 * 1000;
    expect(await ob.flush(sender)).toMatchObject({ sent: 1 });
    expect(await ob.size()).toBe(0);
  });

  it("is idempotent per clientAnnotationId (re-queue replaces, not duplicates)", async () => {
    const ob = new Outbox(memStore());
    const fail = async () => {
      throw new Error("offline");
    };
    await ob.send(payload("dup"), fail);
    await ob.send(payload("dup"), fail);
    expect(await ob.size()).toBe(1);
  });

  it("caps the queue, dropping the oldest", async () => {
    const ob = new Outbox(memStore(), () => Date.now(), 2);
    const fail = async () => {
      throw new Error("offline");
    };
    await ob.send(payload("1"), fail);
    await ob.send(payload("2"), fail);
    await ob.send(payload("3"), fail);
    expect(await ob.size()).toBe(2);
  });
});
