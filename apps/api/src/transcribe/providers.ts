/**
 * Transcription adapters. Workers AI Whisper is the default (no external key);
 * HTTP covers OpenAI/Groq-compatible endpoints. Both are runtime-only and not
 * exercised by the cloud-free test suite.
 */
import type { AiBinding, Transcriber, TranscribeInput, TranscribeResult } from "./types.js";

/** No provider configured — surfaces a clear, actionable failure. */
export class NoopTranscriber implements Transcriber {
  async transcribe(): Promise<TranscribeResult> {
    throw new Error("No transcription provider configured (SuperAdmin platform config)");
  }
}

/** Cloudflare Workers AI Whisper (default). `env.AI` binding. */
export class WorkersAiTranscriber implements Transcriber {
  constructor(
    private readonly ai: AiBinding,
    private readonly model = "@cf/openai/whisper",
  ) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const audio = [...new Uint8Array(input.bytes)];
    const res = (await this.ai.run(this.model, { audio })) as { text?: string };
    return { text: res.text ?? "" };
  }
}

/** OpenAI / Groq compatible `/audio/transcriptions` (multipart). */
export class HttpTranscriber implements Transcriber {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const form = new FormData();
    form.append("file", new Blob([input.bytes], { type: input.contentType }), "audio");
    form.append("model", this.model);
    if (input.languageHint) form.append("language", input.languageHint);
    const r = await fetch(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!r.ok) throw new Error(`Transcription provider failed (${r.status})`);
    const data = (await r.json()) as { text?: string; language?: string };
    return {
      text: data.text ?? "",
      ...(data.language ? { language: data.language } : {}),
    };
  }
}
