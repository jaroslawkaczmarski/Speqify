import { AiError, DEFAULT_MODELS, type AiSettings } from "./types.js";

/** Chrome built-in Prompt API (Gemini Nano). Present only in supporting Chrome. */
declare global {
  var LanguageModel:
    | {
        availability(): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
        create(options?: {
          initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
          temperature?: number;
          topK?: number;
        }): Promise<{ prompt(input: string): Promise<string>; destroy(): void }>;
      }
    | undefined;
}

export interface ChatRequest {
  system: string;
  user: string;
  /** Lower = more deterministic. */
  temperature?: number;
}

/** Send a chat request to the configured provider and return the raw text reply. */
export async function callModel(settings: AiSettings, req: ChatRequest): Promise<string> {
  switch (settings.provider) {
    case "openai":
    case "compatible":
      return callOpenAiCompatible(settings, req);
    case "anthropic":
      return callAnthropic(settings, req);
    case "google":
      return callGoogle(settings, req);
    case "chrome":
      return callChrome(req);
    default:
      throw new AiError(`Unknown AI provider: ${String(settings.provider)}`);
  }
}

function modelOf(settings: AiSettings): string {
  return settings.model?.trim() || DEFAULT_MODELS[settings.provider];
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`;
}

async function callOpenAiCompatible(settings: AiSettings, req: ChatRequest): Promise<string> {
  const base = (settings.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelOf(settings),
      temperature: req.temperature ?? 0.3,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new AiError(`AI request failed: ${await readError(res)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("AI returned an empty response");
  return content;
}

async function callAnthropic(settings: AiSettings, req: ChatRequest): Promise<string> {
  if (!settings.apiKey) throw new AiError("Anthropic requires an API key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelOf(settings),
      max_tokens: 2048,
      temperature: req.temperature ?? 0.3,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  });
  if (!res.ok) throw new AiError(`AI request failed: ${await readError(res)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.map((c) => c.text ?? "").join("") ?? "";
  if (!text) throw new AiError("AI returned an empty response");
  return text;
}

async function callGoogle(settings: AiSettings, req: ChatRequest): Promise<string> {
  if (!settings.apiKey) throw new AiError("Google Gemini requires an API key");
  const model = modelOf(settings);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": settings.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: {
          temperature: req.temperature ?? 0.3,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!res.ok) throw new AiError(`AI request failed: ${await readError(res)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new AiError("AI returned an empty response");
  return text;
}

async function callChrome(req: ChatRequest): Promise<string> {
  const lm = globalThis.LanguageModel;
  if (!lm) {
    throw new AiError(
      "Chrome built-in AI is not available in this browser. Enable it or pick another provider.",
    );
  }
  const status = await lm.availability();
  if (status === "unavailable") {
    throw new AiError("Chrome built-in AI is unavailable on this device.");
  }
  const session = await lm.create({
    initialPrompts: [{ role: "system", content: req.system }],
    temperature: req.temperature ?? 0.3,
  });
  try {
    const out = await session.prompt(req.user);
    if (!out) throw new AiError("AI returned an empty response");
    return out;
  } finally {
    session.destroy();
  }
}
