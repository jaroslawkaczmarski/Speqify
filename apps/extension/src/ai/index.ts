import { TicketSchema, emptyTicket, extractJson, isLocalEndpoint, isSafeEndpoint, type CaptureContext, type Ticket, type TicketType } from "@speqify/core";
import type { AiConfig, RemoteEndpoint } from "@/store";
import { buildDraftSystem, buildDraftUser } from "./prompt";
import { blobToPcm16k, loadLocal, localGenerate, localLoaded, localTranscribe } from "./local";
import { nanoGenerate, nanoUsable } from "./chrome-ai";
import { remoteChat, remoteTranscribe } from "./remote";

export type { LoadProgress } from "./local";
export { loadLocal, localLoaded, unloadLocal } from "./local";

/** A remote endpoint can run once it has a URL + model and either a key or is localhost. */
function remoteUsable(r: RemoteEndpoint): boolean {
  if (!r.endpoint.trim() || !r.model.trim() || !isSafeEndpoint(r.endpoint)) return false;
  // A key is required unless talking to a local model server (localhost).
  return Boolean(r.apiKey.trim() || isLocalEndpoint(r.endpoint));
}

/** Can the configured Voice model turn the recording into text? */
export function transcribeReady(ai: AiConfig): boolean {
  return ai.voiceMode === "local" ? ai.speechDownloaded : remoteUsable(ai.voiceRemote);
}

/** Can the configured AI model draft a ticket? (Local prefers Chrome's Gemini Nano.) */
export function draftReady(ai: AiConfig): boolean {
  return ai.draftMode === "local" ? nanoUsable() || ai.llmDownloaded : remoteUsable(ai.draftRemote);
}

/** Both halves ready — drives the "set up AI" banner on the capture screen. */
export function aiReady(ai: AiConfig): boolean {
  return transcribeReady(ai) && draftReady(ai);
}

export function aiReason(ai: AiConfig): string | null {
  if (aiReady(ai)) return null;
  if (!transcribeReady(ai)) {
    return ai.voiceMode === "local"
      ? "Download the local Voice model in Settings → Voice & AI so your recording can be transcribed."
      : "Add your Voice (transcription) API endpoint, key and model in Settings → Voice & AI.";
  }
  // Transcription is set up, drafting isn't.
  return ai.draftMode === "local"
    ? "Set up the AI drafting model in Settings → Voice & AI — enable Chrome's Gemini Nano or download the local model."
    : "Add your AI (drafting) API endpoint, key and model in Settings → Voice & AI.";
}

/** Transcribe recorded audio. Returns "" when no audio / the Voice model isn't ready. */
export async function transcribeAudio(ai: AiConfig, audio: Blob | null): Promise<string> {
  if (!audio) return "";
  // Never trigger a model download here — only transcribe once the user has opted in
  // (local Voice model downloaded, or a remote Voice endpoint configured).
  if (!transcribeReady(ai)) return "";
  try {
    if (ai.voiceMode === "local") {
      // Speech model only — the drafting model loads at draft time, if local.
      if (!localLoaded(ai.localTier, true, false)) await loadLocal(ai.localTier, undefined, { needAsr: true, needLlm: false });
      const pcm = await blobToPcm16k(audio);
      return await localTranscribe(pcm, ai.detectedLang);
    }
    return await remoteTranscribe(ai.voiceRemote, audio, ai.detectedLang);
  } catch (err) {
    console.warn("[speqify] transcription failed", err);
    return "";
  }
}

/** Turn a transcript (+ context) into a structured ticket via the configured AI model. */
export async function draftTicket(
  ai: AiConfig,
  transcript: string,
  context?: CaptureContext,
  templates?: Partial<Record<TicketType, string>>,
): Promise<Ticket> {
  const opts = { translateTo: ai.translateTo, autoLabels: ai.autoLabels, templates };
  const system = buildDraftSystem(opts);
  const user = buildDraftUser(transcript, context, opts);
  let raw: string;
  if (ai.draftMode === "local") {
    if (nanoUsable()) {
      // Chrome's on-device Gemini Nano — fast, off-thread, no Qwen download.
      raw = await nanoGenerate(system, user);
    } else {
      // Drafting model only — don't re-load Whisper here.
      if (!localLoaded(ai.localTier, false, true)) await loadLocal(ai.localTier, undefined, { needAsr: false, needLlm: true });
      raw = await localGenerate(system, user);
    }
  } else {
    raw = await remoteChat(ai.draftRemote, system, user);
  }
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    json = null; // unparseable model output — handled by the fallback below
  }
  const parsed = json != null ? TicketSchema.safeParse(json) : null;
  if (parsed?.success) {
    // Respect the auto-labels setting even if the model ignored the instruction.
    return ai.autoLabels ? parsed.data : { ...parsed.data, labels: [] };
  }
  // Model returned something unparseable — fall back to a draft built from the
  // user's own words (never invent), so a bad JSON reply can't lose the note.
  return {
    ...emptyTicket(),
    title: transcript.trim().slice(0, 80) || "New issue",
    description: transcript.trim() || "",
  };
}
