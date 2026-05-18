import { Hono } from "hono";
import type { ApiError } from "@speqify/shared";

/**
 * Speqify API — Hono on Cloudflare Workers.
 *
 * Skeleton only (Phase 0). Routes for panels / ingest / submit / analyze /
 * export land in Phases 1–9. The error envelope + correlation id are wired now
 * because every later route depends on them (IMPLEMENTATION_PLAN.md §9, §14).
 */
export interface Env {
  /** Bindings (D1, R2, Queues, Workers AI) are wired in later phases. */
  readonly ENVIRONMENT?: string;
  // DB: D1Database;
  // MEDIA: R2Bucket;
  // TRANSCRIPTION_QUEUE: Queue;
  // AI: Ai;
}

const app = new Hono<{ Bindings: Env; Variables: { correlationId: string } }>();

app.use("*", async (c, next) => {
  const correlationId = c.req.header("x-correlation-id") ?? crypto.randomUUID();
  c.set("correlationId", correlationId);
  c.header("x-correlation-id", correlationId);
  await next();
});

app.get("/health", (c) => c.json({ status: "ok", service: "speqify-api" }));

app.notFound((c) => {
  const body: ApiError = {
    error: {
      code: "not_found",
      message: "Route not found",
      correlationId: c.get("correlationId"),
    },
  };
  return c.json(body, 404);
});

app.onError((err, c) => {
  const body: ApiError = {
    error: {
      code: "internal_error",
      message: err instanceof Error ? err.message : "Unexpected error",
      correlationId: c.get("correlationId"),
    },
  };
  return c.json(body, 500);
});

export default app;
