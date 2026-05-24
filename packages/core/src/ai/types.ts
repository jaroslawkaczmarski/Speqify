export type AiProviderKind =
  | "openai"
  | "anthropic"
  | "google"
  | "compatible"
  | "chrome";

export interface AiSettings {
  provider: AiProviderKind;
  /** Cloud API key. Not used for `compatible` (optional) or `chrome`. */
  apiKey?: string;
  /** Model id, e.g. "gpt-4o-mini", "claude-sonnet-4-6", "gemini-2.5-flash", "llama3.1". */
  model?: string;
  /** Base URL for `compatible` local servers, e.g. "http://localhost:11434/v1". */
  baseUrl?: string;
}

export const DEFAULT_MODELS: Record<AiProviderKind, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.5-flash",
  compatible: "llama3.1",
  chrome: "gemini-nano",
};

export const PROVIDER_LABELS: Record<AiProviderKind, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  compatible: "Local / OpenAI-compatible",
  chrome: "Chrome built-in (Gemini Nano)",
};

export function defaultAiSettings(): AiSettings {
  return { provider: "openai", model: DEFAULT_MODELS.openai };
}

export class AiError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}
