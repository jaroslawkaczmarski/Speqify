/** Raised when an AI step fails (bad output, transport error, …). */
export class AiError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}
