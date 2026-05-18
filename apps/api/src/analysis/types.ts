/** LLM provider port (Claude/OpenAI/Gemini via AI Gateway, §3). */
export interface LlmCompletion {
  system: string;
  user: string;
}

export interface LlmProvider {
  /** Returns the model's raw text (expected to be JSON for analysis). */
  complete(input: LlmCompletion): Promise<string>;
}
