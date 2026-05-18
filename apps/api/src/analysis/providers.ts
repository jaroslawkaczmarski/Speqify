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
    if (!r.ok) throw new Error(`LLM provider failed (${r.status})`);
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
