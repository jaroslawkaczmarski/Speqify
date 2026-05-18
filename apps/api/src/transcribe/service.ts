/**
 * Transcription orchestration (Phase 6 / §14). Pure: repo, media store and
 * provider are injected, so the whole job is unit-tested without Cloudflare.
 * The runtime trigger (Cloudflare Queue consumer + Cron) needs Workers Paid;
 * the same `runOnce` is what that consumer will call.
 */
import type { MediaStore } from "../media/types.js";
import type { Repository } from "../repo/types.js";
import type { Transcriber } from "./types.js";

export interface TranscriptionDeps {
  repo: Repository;
  mediaStore: MediaStore;
  transcriber: Transcriber;
}

export interface TranscriptionRunResult {
  processed: number;
  done: number;
  empty: number;
  failed: number;
}

export async function runOnce(
  deps: TranscriptionDeps,
  opts: { batch?: number; languageHint?: string } = {},
): Promise<TranscriptionRunResult> {
  const batch = opts.batch ?? 20;
  const pending = await deps.repo.listTranscribable(batch);
  const result: TranscriptionRunResult = { processed: 0, done: 0, empty: 0, failed: 0 };

  for (const a of pending) {
    result.processed++;
    const audio = a.recordingAudio ?? a.voice;
    if (!audio) {
      await deps.repo.setTranscription(a.id, a.transcript, "failed");
      result.failed++;
      continue;
    }

    const media = await deps.mediaStore.get(audio.bucketKey);
    if (!media) {
      await deps.repo.setTranscription(a.id, a.transcript, "failed");
      result.failed++;
      continue;
    }

    await deps.repo.setTranscription(a.id, a.transcript, "running");
    try {
      const out = await deps.transcriber.transcribe({
        bytes: media.body,
        contentType: media.contentType,
        ...(opts.languageHint ? { languageHint: opts.languageHint } : {}),
      });
      const text = out.text.trim();
      // Empty/silent audio: mark done with empty text so it is NOT retried
      // forever and never feeds the AI as garbage (§14).
      await deps.repo.setTranscription(a.id, text, "done");
      if (text.length === 0) result.empty++;
      else result.done++;
    } catch {
      await deps.repo.setTranscription(a.id, a.transcript, "failed");
      result.failed++;
    }
  }
  return result;
}
