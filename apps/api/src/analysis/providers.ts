/** LLM adapters. HTTP targets an AI-Gateway / OpenAI-compatible chat endpoint. */
import type { LlmCompletion, LlmProvider } from "./types.js";

export class NoopLlmProvider implements LlmProvider {
  async complete(): Promise<string> {
    throw new Error("No LLM provider configured (SuperAdmin platform config)");
  }
}

export class HttpLlmProvider implements LlmProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(input: LlmCompletion): Promise<string> {
    const r = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        // OpenRouter ranking attribution (ignored by non-OR providers).
        "HTTP-Referer": "https://speqify.app",
        "X-Title": "Speqify",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error(
        `LLM provider failed (${r.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

/** Resolves config per-call so SA Providers UI takes effect without redeploy.
 *  Returns null when neither DB nor env have a usable config — `complete()`
 *  then throws the same friendly "no provider configured" error. */
export type LlmResolved = { endpoint: string; apiKey: string; model: string };

export class DynamicLlmProvider implements LlmProvider {
  constructor(private readonly resolve: () => Promise<LlmResolved | null>) {}

  async complete(input: LlmCompletion): Promise<string> {
    const cfg = await this.resolve();
    if (!cfg) throw new Error("No LLM provider configured (SuperAdmin platform config)");
    return new HttpLlmProvider(cfg.endpoint, cfg.apiKey, cfg.model).complete(input);
  }
}
