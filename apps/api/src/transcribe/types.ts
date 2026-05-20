/** Transcription provider port (configurable per platform, §9). */
export interface TranscribeInput {
  bytes: ArrayBuffer;
  contentType: string;
  languageHint?: string;
}

export interface TranscribeResult {
  text: string;
  language?: string;
}

export interface Transcriber {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

/** Minimal Workers AI binding shape (version-proof; avoids workers-types drift). */
export interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

/**
 * Queue message = a poke, not a work item. `runOnce` is an idempotent sweep
 * over `listTranscribable`, so the consumer ignores the body; the ids are
 * carried only for log correlation.
 */
export interface TranscriptionMessage {
  kind: "transcribe";
  sessionId: string;
  submissionId: string;
}
