import { HttpLlmProvider, NoopLlmProvider } from "./analysis/providers.js";
import type { LlmProvider } from "./analysis/types.js";
import { createApp } from "./app.js";
import { resolveConfig, type Env } from "./env.js";
import { InMemoryMediaStore } from "./media/memory.js";
import { R2MediaStore } from "./media/r2.js";
import type { MediaStore } from "./media/types.js";
import { D1Repository } from "./repo/d1.js";
import { InMemoryRepository } from "./repo/memory.js";
import type { Repository } from "./repo/types.js";
import { HttpTranscriber, NoopTranscriber, WorkersAiTranscriber } from "./transcribe/providers.js";
import type { Transcriber } from "./transcribe/types.js";

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
      let transcriber: Transcriber;
      if (env.AI) transcriber = new WorkersAiTranscriber(env.AI);
      else if (env.TRANSCRIBE_ENDPOINT && env.TRANSCRIBE_API_KEY)
        transcriber = new HttpTranscriber(
          env.TRANSCRIBE_ENDPOINT,
          env.TRANSCRIBE_API_KEY,
          env.TRANSCRIBE_MODEL ?? "whisper-1",
        );
      else transcriber = new NoopTranscriber();
      const llm: LlmProvider =
        env.LLM_ENDPOINT && env.LLM_API_KEY
          ? new HttpLlmProvider(env.LLM_ENDPOINT, env.LLM_API_KEY, env.LLM_MODEL ?? "gpt-4o-mini")
          : new NoopLlmProvider();
      return createApp({ repo, config, mediaStore, transcriber, llm }).fetch(request, env, ctx);
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
