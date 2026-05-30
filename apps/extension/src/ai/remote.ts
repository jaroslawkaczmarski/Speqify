import { isSafeEndpoint } from "@speqify/core";
import type { RemoteEndpoint } from "@/store";

function base(cfg: RemoteEndpoint): string {
  const url = cfg.endpoint.trim().replace(/\/$/, "");
  if (!isSafeEndpoint(url)) {
    throw new Error(`Refusing to send your API key to a non-HTTPS endpoint: ${url || "(empty)"}`);
  }
  return url;
}

function authHeaders(cfg: RemoteEndpoint): Record<string, string> {
  return cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {};
}

/** OpenAI-compatible /audio/transcriptions (Whisper). */
export async function remoteTranscribe(cfg: RemoteEndpoint, audio: Blob, lang?: string): Promise<string> {
  const model = cfg.model.trim();
  if (!model) {
    throw new Error("No transcription model set for this endpoint (audio → text not supported here).");
  }
  const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", audio, `audio.${ext}`);
  form.append("model", model);
  if (lang && lang !== "auto") form.append("language", lang);
  const res = await fetch(`${base(cfg)}/audio/transcriptions`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

/** OpenAI-compatible /chat/completions. */
export async function remoteChat(cfg: RemoteEndpoint, system: string, user: string): Promise<string> {
  const res = await fetch(`${base(cfg)}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(cfg) },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
