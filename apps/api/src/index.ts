import { createApp } from "./app.js";
import { resolveConfig, type Env } from "./env.js";
import { InMemoryMediaStore } from "./media/memory.js";
import { R2MediaStore } from "./media/r2.js";
import type { MediaStore } from "./media/types.js";
import { D1Repository } from "./repo/d1.js";
import { InMemoryRepository } from "./repo/memory.js";
import type { Repository } from "./repo/types.js";

/**
 * Speqify API — Cloudflare Worker entry (IMPLEMENTATION_PLAN.md §6 Phase 1).
 * Without a D1 binding it falls back to an in-memory repo (local dev only).
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const config = resolveConfig(env);
      const repo: Repository = env.DB ? new D1Repository(env.DB) : new InMemoryRepository();
      const mediaStore: MediaStore = env.MEDIA
        ? new R2MediaStore(env.MEDIA)
        : new InMemoryMediaStore();
      return createApp({ repo, config, mediaStore }).fetch(request, env, ctx);
    } catch (err) {
      const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
      return Response.json(
        {
          error: {
            code: "internal_error",
            message: err instanceof Error ? err.message : "Boot error",
            correlationId,
          },
        },
        { status: 500 },
      );
    }
  },
};
