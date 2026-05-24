import { TicketSchema, emptyTicket, extractJson, type CaptureContext, type Ticket } from "@speqify/core";
import type { AiConfig } from "@/store";
import { DRAFT_SYSTEM, buildDraftUser } from "./prompt";
import { blobToPcm16k, loadLocal, localGenerate, localLoaded, localTranscribe, type LoadProgress } from "./local";
import { remoteChat, remoteTranscribe } from "./remote";

export type { LoadProgress } from "./local";
export { loadLocal, localLoaded, unloadLocal } from "./local";

/** Is the configured AI able to draft tickets right now? */
export function aiReady(ai: AiConfig): boolean {
  if (ai.mode === "local") return ai.localDownloaded;
  const r = ai.remote;
  return Boolean(r.endpoint.trim() && (r.apiKey.trim() || /localhost|127\.0\.0\.1/.test(r.endpoint)));
}

export function aiReason(ai: AiConfig): string | null {
  if (aiReady(ai)) return null;
  return ai.mode === "local"
    ? "Download a local model in Settings → Voice & AI to generate tickets from your voice."
    : "Add an API endpoint and key in Settings → Voice & AI to generate tickets.";
}

async function ensureLocal(ai: AiConfig, onProgress?: (p: LoadProgress) => void): Promise<void> {
  if (ai.mode === "local" && !localLoaded(ai.localTier)) await loadLocal(ai.localTier, onProgress);
}

/** Transcribe recorded audio. Returns "" when no audio / AI isn't ready. */
export async function transcribeAudio(ai: AiConfig, audio: Blob | null): Promise<string> {
  if (!audio) return "";
  // Never trigger a model download here — only transcribe once the user has opted in
  // (local model downloaded, or a remote endpoint configured).
  if (!aiReady(ai)) return "";
  try {
    if (ai.mode === "local") {
      await ensureLocal(ai);
      const pcm = await blobToPcm16k(audio);
      return await localTranscribe(pcm, ai.detectedLang);
    }
    return await remoteTranscribe(ai.remote, audio, ai.detectedLang);
  } catch (err) {
    console.warn("[speqify] transcription failed", err);
    return "";
  }
}

/** Turn a transcript (+ context) into a structured ticket via the configured model. */
export async function draftTicket(ai: AiConfig, transcript: string, context?: CaptureContext): Promise<Ticket> {
  const user = buildDraftUser(transcript, context, ai.translateTo);
  let raw: string;
  if (ai.mode === "local") {
    await ensureLocal(ai);
    raw = await localGenerate(DRAFT_SYSTEM, user);
  } else {
    raw = await remoteChat(ai.remote, DRAFT_SYSTEM, user);
  }
  const parsed = TicketSchema.safeParse(extractJson(raw));
  if (parsed.success) return parsed.data;
  // Model returned something unparseable — fall back to a sensible draft.
  return {
    ...emptyTicket(),
    title: transcript.trim().slice(0, 80) || "New issue",
    description: transcript.trim() || "",
  };
}
