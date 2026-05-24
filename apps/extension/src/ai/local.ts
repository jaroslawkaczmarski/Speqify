import { browser } from "#imports";
import type { LocalTier } from "@/store";

/** HF model ids (transformers.js / ONNX, WebGPU-capable). */
export const TIER_MODELS: Record<LocalTier, { stt: string; llm: string }> = {
  light: { stt: "onnx-community/whisper-tiny", llm: "onnx-community/Qwen2.5-0.5B-Instruct" },
  medium: { stt: "onnx-community/whisper-base", llm: "onnx-community/Qwen2.5-1.5B-Instruct" },
};

export interface LoadProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

// Lazily imported so @huggingface/transformers (and its wasm) only loads on demand.
type AnyPipeline = (input: unknown, options?: Record<string, unknown>) => Promise<unknown>;

let asr: AnyPipeline | null = null;
let gen: AnyPipeline | null = null;
let loadedTier: LocalTier | null = null;

export function localLoaded(tier: LocalTier): boolean {
  return loadedTier === tier && asr !== null && gen !== null;
}

let configured = false;

export async function loadLocal(tier: LocalTier, onProgress?: (p: LoadProgress) => void): Promise<void> {
  if (localLoaded(tier)) return;
  const transformers = await import("@huggingface/transformers");
  const { pipeline } = transformers;

  if (!configured) {
    // ONNX Runtime Web's wasm/mjs must come from the extension itself — the MV3
    // CSP (script-src 'self') blocks importing them from the jsDelivr CDN.
    const env = transformers.env as unknown as {
      allowRemoteModels: boolean;
      backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } };
    };
    env.allowRemoteModels = true;
    const getURL = browser.runtime.getURL as (path: string) => string;
    env.backends.onnx.wasm.wasmPaths = getURL("/ort/");
    env.backends.onnx.wasm.numThreads = 1; // no SharedArrayBuffer in extension pages
    configured = true;
  }

  const m = TIER_MODELS[tier];
  const opts = { dtype: "q4", device: "webgpu", progress_callback: onProgress } as Record<string, unknown>;
  asr = (await pipeline("automatic-speech-recognition", m.stt, opts)) as unknown as AnyPipeline;
  gen = (await pipeline("text-generation", m.llm, opts)) as unknown as AnyPipeline;
  loadedTier = tier;
}

export function unloadLocal(): void {
  asr = null;
  gen = null;
  loadedTier = null;
}

/** Decode an audio Blob into mono Float32 PCM at 16 kHz (Whisper's expected rate). */
export async function blobToPcm16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    void ctx.close();
  }
  if (decoded.sampleRate === 16000 && decoded.numberOfChannels === 1) {
    return decoded.getChannelData(0).slice();
  }
  // Resample to 16 kHz mono (some browsers ignore a requested AudioContext rate).
  const frames = Math.max(1, Math.ceil(decoded.duration * 16000));
  const offline = new OfflineAudioContext(1, frames, 16000);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export async function localTranscribe(pcm: Float32Array, lang?: string): Promise<string> {
  if (!asr) throw new Error("Local STT model is not loaded");
  const out = (await asr(pcm, {
    language: lang && lang !== "auto" ? lang : undefined,
    task: "transcribe",
    chunk_length_s: 30,
  })) as { text?: string } | { text?: string }[];
  return (Array.isArray(out) ? out[0]?.text : out.text) ?? "";
}

export async function localGenerate(system: string, user: string): Promise<string> {
  if (!gen) throw new Error("Local model is not loaded");
  const out = (await gen(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_new_tokens: 512, do_sample: false },
  )) as { generated_text?: unknown }[];
  const g = out[0]?.generated_text;
  if (Array.isArray(g)) {
    const last = g[g.length - 1] as { content?: string } | undefined;
    return last?.content ?? "";
  }
  return typeof g === "string" ? g : "";
}
