import { browser } from "#imports";
import type { LocalTier } from "@/store";
import type { EngineLoadOpts } from "./engine";
// `?worker` is Vite's canonical worker import — it bundles local-worker.ts (and
// its transformers/engine deps) into a separate file and gives us a constructor.
import LocalWorker from "./local-worker?worker";

/** HF model ids (transformers.js / ONNX, WebGPU-capable). */
export const TIER_MODELS: Record<LocalTier, { stt: string; llm: string }> = {
  light: { stt: "onnx-community/whisper-tiny", llm: "onnx-community/Qwen3-0.6B-ONNX" },
  medium: { stt: "onnx-community/whisper-base", llm: "onnx-community/Qwen3-1.7B-ONNX" },
};

export interface LoadProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

// ── Worker plumbing ───────────────────────────────────────────────────────
// Inference runs in a Web Worker so it doesn't freeze the panel. If the worker
// can't be created/used, we transparently fall back to the same engine on the
// main thread (older behaviour: works, but stalls the UI).
let worker: Worker | null = null;
let workerUsable = typeof Worker !== "undefined";
let usingWorker = false;
let loadedTier: LocalTier | null = null;
let asrLoaded = false;
let genLoaded = false;
let seq = 0;

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: LoadProgress) => void };
const pending = new Map<number, Pending>();

function spawnWorker(): Worker | null {
  try {
    const w = new LocalWorker();
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { id: number; type: string; progress?: LoadProgress; result?: unknown; error?: string };
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === "progress") {
        p.onProgress?.(m.progress as LoadProgress);
        return;
      }
      pending.delete(m.id);
      if (m.type === "result") p.resolve(m.result);
      else p.reject(new Error(m.error || "worker error"));
    };
    return w;
  } catch {
    workerUsable = false;
    return null;
  }
}

function callWorker<T>(method: string, payload: unknown, onProgress?: (p: LoadProgress) => void, transfer?: Transferable[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    worker!.postMessage({ id, method, payload }, transfer ?? []);
  });
}

const engine = () => import("./engine");

// On-device model weights (~0.7 GB) are cached by Transformers.js in the Cache
// API under the extension origin. That storage is "best-effort" by default, so
// the browser may EVICT it under disk pressure — the model then silently
// re-downloads on next use even though chrome.storage still flags it installed
// (that flag lives in durable storage; the weights don't). Requesting persistent
// storage exempts the origin from eviction, so a once-downloaded model survives
// reloads and restarts. `persist()` is a Window-only API and loadLocal always
// runs on the panel/options page (never in the worker), so it's safe here.
// Idempotent; never blocks model loading if it fails.
let persistenceRequested = false;
async function requestPersistentStorage(): Promise<void> {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    const sm = navigator.storage;
    if (!sm?.persist || !sm.persisted || (await sm.persisted())) return;
    if (!(await sm.persist())) {
      console.warn("[speqify] Persistent storage denied — the on-device model cache may be evicted by the browser.");
    }
  } catch {
    /* best-effort — never block model loading on this */
  }
}

export interface LoadFlags {
  /** Load Whisper (speech → text). */
  needAsr?: boolean;
  /** Load Qwen (text → ticket). */
  needLlm?: boolean;
}

export function localLoaded(tier: LocalTier, needAsr: boolean, needLlm: boolean): boolean {
  return loadedTier === tier && (!needAsr || asrLoaded) && (!needLlm || genLoaded);
}

export async function loadLocal(
  tier: LocalTier,
  onProgress?: (p: LoadProgress) => void,
  flags: LoadFlags = {},
): Promise<void> {
  const needAsr = flags.needAsr ?? true;
  const needLlm = flags.needLlm ?? true;
  if (localLoaded(tier, needAsr, needLlm)) return;
  // Make the model cache durable before downloading ~0.7 GB into it (see above),
  // so it isn't silently evicted between sessions and re-downloaded on next use.
  await requestPersistentStorage();
  if (loadedTier !== tier) {
    asrLoaded = false;
    genLoaded = false;
  }
  const ortPath = (browser.runtime.getURL as (p: string) => string)("/ort/");
  const payload: EngineLoadOpts = { tier, models: TIER_MODELS[tier], ortPath, needAsr, needLlm };

  if (workerUsable) {
    if (!worker) worker = spawnWorker();
    if (worker) {
      try {
        await callWorker<boolean>("load", payload, onProgress);
        usingWorker = true;
        loadedTier = tier;
        if (needAsr) asrLoaded = true;
        if (needLlm) genLoaded = true;
        return;
      } catch {
        // Worker failed (bundling/runtime) — drop it and use the main thread.
        workerUsable = false;
        worker?.terminate();
        worker = null;
      }
    }
  }

  usingWorker = false;
  const eng = await engine();
  await eng.engineLoad(payload, (p) => onProgress?.(p as LoadProgress));
  loadedTier = tier;
  if (needAsr) asrLoaded = true;
  if (needLlm) genLoaded = true;
}

export async function localTranscribe(pcm: Float32Array, lang?: string): Promise<string> {
  if (usingWorker && worker) return callWorker<string>("transcribe", { pcm, lang }, undefined, [pcm.buffer]);
  return (await engine()).engineTranscribe(pcm, lang);
}

export async function localGenerate(system: string, user: string): Promise<string> {
  if (usingWorker && worker) return callWorker<string>("generate", { system, user });
  return (await engine()).engineGenerate(system, user);
}

export function unloadLocal(): void {
  loadedTier = null;
  asrLoaded = false;
  genLoaded = false;
  worker?.terminate();
  worker = null;
  usingWorker = false;
  void engine()
    .then((e) => e.engineUnload())
    .catch(() => {});
}

/** Decode an audio Blob into mono Float32 PCM at 16 kHz (Whisper's expected rate).
 *  Stays on the main thread — AudioContext isn't available inside a worker. */
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
