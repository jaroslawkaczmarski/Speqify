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
