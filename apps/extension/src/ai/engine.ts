// Transformers.js engine — the actual model loading + inference. Runs either
// inside the Web Worker (local-worker.ts) or, as a fallback, on the main thread
// (imported dynamically by local.ts). It touches no extension APIs: the ORT path
// is passed in, so the same code works in both contexts.
import * as transformers from "@huggingface/transformers";

type AnyPipeline = (input: unknown, options?: Record<string, unknown>) => Promise<unknown>;

let asr: AnyPipeline | null = null;
let gen: AnyPipeline | null = null;
let loadedTier: string | null = null;
let configured = false;

export interface EngineLoadOpts {
  tier: string;
  models: { stt: string; llm: string };
  /** Absolute URL of the bundled ONNX Runtime Web assets (must be same-origin). */
  ortPath: string;
  /** Load the speech-to-text (Whisper) model. False when Voice uses a remote API. */
  needAsr: boolean;
  /** Load the text-generation (drafting) model. False when Gemini Nano / a remote API drafts. */
  needLlm: boolean;
}

export function engineLoaded(tier: string, needAsr: boolean, needLlm: boolean): boolean {
  return loadedTier === tier && (!needAsr || asr !== null) && (!needLlm || gen !== null);
}

export async function engineLoad(opts: EngineLoadOpts, onProgress?: (p: unknown) => void): Promise<void> {
  const { pipeline } = transformers;
  if (!configured) {
    // ONNX Runtime Web's wasm/mjs must be served from the extension itself: the MV3
    // CSP (script-src 'self') blocks ORT's default jsDelivr CDN. In v4 `backends.onnx`
    // starts empty and its `wasm` sub-object is filled in lazily, so create it safely.
    const env = transformers.env as unknown as {
      allowRemoteModels: boolean;
      backends: { onnx: { wasm?: { wasmPaths?: string } } };
    };
    env.allowRemoteModels = true;
    (env.backends.onnx.wasm ??= {}).wasmPaths = opts.ortPath;
    configured = true;
  }
  if (loadedTier !== opts.tier) {
    asr = null;
    gen = null;
    loadedTier = opts.tier;
  }
  // Prefer WebGPU (fast); fall back to WASM/CPU so it still runs without a GPU.
  const hasGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  const device = hasGPU ? "webgpu" : "wasm";
  // Whisper has no q4f16 ONNX build (requesting it throws "Unsupported model type:
  // whisper"), so it stays q4 — which runs on GPU and CPU. Qwen3 ships a q4f16 build
  // that's smaller and faster on WebGPU; fall back to q4 on CPU/wasm (no fp16 there).
  const asrOpts = { dtype: "q4", device, progress_callback: onProgress } as Record<string, unknown>;
  const llmOpts = { dtype: hasGPU ? "q4f16" : "q4", device, progress_callback: onProgress } as Record<string, unknown>;
  if (opts.needAsr && !asr) asr = (await pipeline("automatic-speech-recognition", opts.models.stt, asrOpts)) as unknown as AnyPipeline;
  if (opts.needLlm && !gen) {
    gen = (await pipeline("text-generation", opts.models.llm, llmOpts)) as unknown as AnyPipeline;
  }
}

export async function engineTranscribe(pcm: Float32Array, lang?: string): Promise<string> {
  if (!asr) throw new Error("Local STT model is not loaded");
  const out = (await asr(pcm, {
    language: lang && lang !== "auto" ? lang : undefined,
    task: "transcribe",
    chunk_length_s: 30,
  })) as { text?: string } | { text?: string }[];
  return (Array.isArray(out) ? out[0]?.text : out.text) ?? "";
}

export async function engineGenerate(system: string, user: string): Promise<string> {
  if (!gen) throw new Error("Local model is not loaded");
  const out = (await gen(
    [
      { role: "system", content: system },
      // "/no_think" keeps Qwen3 out of its default-on reasoning mode, which would
      // otherwise spend the token budget emitting <think> tokens instead of the ticket.
      { role: "user", content: `${user}\n/no_think` },
    ],
    // Greedy + a tight token budget: a ticket JSON is short, and fewer tokens
    // means a proportionally shorter compute (and shorter stall).
    { max_new_tokens: 300, do_sample: false },
  )) as { generated_text?: unknown }[];
  const g = out[0]?.generated_text;
  let text: string;
  if (Array.isArray(g)) {
    const last = g[g.length - 1] as { content?: string } | undefined;
    text = last?.content ?? "";
  } else {
    text = typeof g === "string" ? g : "";
  }
  // Strip any residual reasoning block so JSON extraction sees only the answer.
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export function engineUnload(): void {
  asr = null;
  gen = null;
  loadedTier = null;
}
