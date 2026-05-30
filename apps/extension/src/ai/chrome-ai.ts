// Chrome's built-in on-device model (Gemini Nano) via the Prompt API.
// When present we use it for DRAFTING — it's GPU-accelerated by Chrome, runs off
// our main thread, and needs no ~0.7 GB download of our own. Speech-to-text still
// uses Whisper (Nano can't transcribe).

interface LanguageModelApi {
  availability(): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create(options?: {
    initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    topK?: number;
  }): Promise<{ prompt(input: string): Promise<string>; destroy?: () => void }>;
}

function lm(): LanguageModelApi | undefined {
  return (globalThis as unknown as { LanguageModel?: LanguageModelApi }).LanguageModel;
}

export type NanoStatus = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";

let cached: NanoStatus | null = null;

/** Probe availability once and cache it. */
export async function probeNano(): Promise<NanoStatus> {
  const api = lm();
  if (!api?.availability) {
    cached = "unsupported";
    return cached;
  }
  try {
    cached = (await api.availability()) as NanoStatus;
  } catch {
    cached = "unsupported";
  }
  return cached;
}

export function nanoStatus(): NanoStatus | null {
  return cached;
}

/** Ready to draft right now (no further download needed). */
export function nanoUsable(): boolean {
  return cached === "available";
}

export async function nanoGenerate(system: string, user: string): Promise<string> {
  const api = lm();
  if (!api) throw new Error("Chrome built-in AI is not available");
  const session = await api.create({
    initialPrompts: [{ role: "system", content: system }],
    temperature: 0.3,
    topK: 3,
  });
  try {
    return await session.prompt(user);
  } finally {
    session.destroy?.();
  }
}
