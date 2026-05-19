import { DynamicLlmProvider } from "./analysis/providers.js";
import type { LlmProvider } from "./analysis/types.js";
import { createApp } from "./app.js";
import { resolveConfig, type Env } from "./env.js";
import { decryptJson } from "./lib/crypto.js";
import { InMemoryMediaStore } from "./media/memory.js";
import { R2MediaStore } from "./media/r2.js";
import type { MediaStore } from "./media/types.js";
import { D1Repository } from "./repo/d1.js";
import { InMemoryRepository } from "./repo/memory.js";
import type { Repository } from "./repo/types.js";
import { runOnce as runTranscription } from "./transcribe/service.js";
import { HttpTranscriber, NoopTranscriber, WorkersAiTranscriber } from "./transcribe/providers.js";
import type { Transcriber, TranscriptionMessage } from "./transcribe/types.js";

interface Runtime {
  repo: Repository;
  mediaStore: MediaStore;
  transcriber: Transcriber;
  llm: LlmProvider;
}

/**
 * Builds the injected ports from the Worker bindings. Shared by the `fetch`
 * entry and the transcription `queue` consumer so both behave identically.
 * Without a D1 binding it falls back to in-memory adapters (local dev only).
 */
/** Default OpenAI-compatible endpoint when the SA UI omits it. */
const DEFAULT_ENDPOINTS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
};

function buildRuntime(env: Env): Runtime {
  const repo: Repository = env.DB ? new D1Repository(env.DB) : new InMemoryRepository();
  const mediaStore: MediaStore = env.MEDIA ? new R2MediaStore(env.MEDIA) : new InMemoryMediaStore();
  let transcriber: Transcriber;
  if (env.AI) transcriber = new WorkersAiTranscriber(env.AI);
  else if (env.TRANSCRIBE_ENDPOINT && env.TRANSCRIBE_API_KEY)
    transcriber = new HttpTranscriber(
      env.TRANSCRIBE_ENDPOINT,
      env.TRANSCRIBE_API_KEY,
      env.TRANSCRIBE_MODEL ?? "whisper-1",
    );
  else transcriber = new NoopTranscriber();

  // LLM is dynamic: SA Providers UI (D1) is the source of truth at request
  // time; env.LLM_* stays as a deploy-time fallback. Reading per call is
  // cheap and avoids stale config until redeploy.
  const llm: LlmProvider = new DynamicLlmProvider(async () => {
    const cfg = await repo.getPlatformConfigInternal();
    if (cfg?.aiKeyRef) {
      try {
        const envelopeKey = env.ENVELOPE_MASTER_KEY;
        if (envelopeKey) {
          const { aiKey } = await decryptJson<{ aiKey: string }>(envelopeKey, cfg.aiKeyRef);
          const endpoint =
            cfg.config.aiEndpoint?.trim() || DEFAULT_ENDPOINTS[cfg.config.aiProvider] || "";
          if (endpoint) {
            return { endpoint, apiKey: aiKey, model: cfg.config.aiModel };
          }
        }
      } catch {
        // fall through to env fallback below
      }
    }
    if (env.LLM_ENDPOINT && env.LLM_API_KEY) {
      return {
        endpoint: env.LLM_ENDPOINT,
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL ?? "gpt-4o-mini",
      };
    }
    return null;
  });

  return { repo, mediaStore, transcriber, llm };
}

/**
 * Speqify API — Cloudflare Worker entry (IMPLEMENTATION_PLAN.md §6 Phase 1).
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const config = resolveConfig(env);
      const { repo, mediaStore, transcriber, llm } = buildRuntime(env);
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

  /**
   * Transcription queue consumer (Phase 6). The message is only a poke —
   * `runOnce` is an idempotent sweep over `listTranscribable`, so a whole
   * batch collapses into a single sweep. Per-annotation failures are handled
   * inside `runOnce` (marked `failed`, retried next run); we only retry the
   * batch if the sweep itself throws (e.g. D1 unavailable).
   */
  async queue(batch: MessageBatch<TranscriptionMessage>, env: Env): Promise<void> {
    const { repo, mediaStore, transcriber } = buildRuntime(env);
    try {
      const r = await runTranscription({ repo, mediaStore, transcriber });
      console.log(
        JSON.stringify({
          level: "info",
          msg: "transcription_queue_run",
          messages: batch.messages.length,
          ...r,
        }),
      );
      batch.ackAll();
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "transcription_queue_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      batch.retryAll();
    }
  },
};
