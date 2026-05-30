// Web Worker that runs the local models off the panel's main thread, so heavy
// inference no longer freezes the UI. It speaks a tiny request/response protocol
// with local.ts. All the real work lives in engine.ts (shared with the
// main-thread fallback).
import { engineGenerate, engineLoad, engineTranscribe, type EngineLoadOpts } from "./engine";

type WorkerReq =
  | { id: number; method: "load"; payload: EngineLoadOpts }
  | { id: number; method: "transcribe"; payload: { pcm: Float32Array; lang?: string } }
  | { id: number; method: "generate"; payload: { system: string; user: string } };

const ctx = globalThis as unknown as {
  onmessage: ((e: MessageEvent<WorkerReq>) => void) | null;
  postMessage: (msg: unknown) => void;
};

const post = (msg: unknown) => ctx.postMessage(msg);

ctx.onmessage = async (e) => {
  const { id, method, payload } = e.data;
  try {
    if (method === "load") {
      await engineLoad(payload, (p) => post({ id, type: "progress", progress: p }));
      post({ id, type: "result", result: true });
    } else if (method === "transcribe") {
      post({ id, type: "result", result: await engineTranscribe(payload.pcm, payload.lang) });
    } else if (method === "generate") {
      post({ id, type: "result", result: await engineGenerate(payload.system, payload.user) });
    }
  } catch (err) {
    post({ id, type: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
