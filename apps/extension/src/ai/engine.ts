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
    // ONNX Runtime Web's wasm/mjs must be served from the extension itself (CSP).
    const env = transformers.env as unknown as {
      allowRemoteModels: boolean;
      backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } };
    };
    env.allowRemoteModels = true;
    env.backends.onnx.wasm.wasmPaths = opts.ortPath;
    env.backends.onnx.wasm.numThreads = 1; // no SharedArrayBuffer here
    configured = true;
  }
  if (loadedTier !== opts.tier) {
    asr = null;
    gen = null;
    loadedTier = opts.tier;
  }
  // Prefer WebGPU (fast); fall back to WASM/CPU so it still runs without a GPU.
  // NB: keep dtype "q4" — Whisper has no q4f16 ONNX variant, and requesting it
  // makes transformers throw "Unsupported model type: whisper". q4 works on both.
  const hasGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  const pOpts = {
    dtype: "q4",
    device: hasGPU ? "webgpu" : "wasm",
    progress_callback: onProgress,
  } as Record<string, unknown>;
  if (opts.needAsr && !asr) asr = (await pipeline("automatic-speech-recognition", opts.models.stt, pOpts)) as unknown as AnyPipeline;
  if (opts.needLlm && !gen) {
    gen = (await pipeline("text-generation", opts.models.llm, pOpts)) as unknown as AnyPipeline;
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
      { role: "user", content: user },
    ],
    // Greedy + a tight token budget: a ticket JSON is short, and fewer tokens
    // means a proportionally shorter compute (and shorter stall).
    { max_new_tokens: 300, do_sample: false },
  )) as { generated_text?: unknown }[];
  const g = out[0]?.generated_text;
  if (Array.isArray(g)) {
    const last = g[g.length - 1] as { content?: string } | undefined;
    return last?.content ?? "";
  }
  return typeof g === "string" ? g : "";
}

export function engineUnload(): void {
  asr = null;
  gen = null;
  loadedTier = null;
}
