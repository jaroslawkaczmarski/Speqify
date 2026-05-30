import type { AreaRect } from "@/messaging";
import type { CaptureDefaults } from "@/store";

export interface ActiveRecorder {
  /** The raw shared surface stream (kept for teardown). */
  displayStream: MediaStream;
  /** What's actually being recorded — bind THIS to the preview so the crop shows. */
  previewStream: MediaStream;
  /** Mic frequency analyser for the waveform. Null if mic unavailable/denied. */
  analyser: AnalyserNode | null;
  /** True if a mic track was acquired. */
  micAvailable: boolean;
  setMicEnabled: (enabled: boolean) => void;
  /** Returns the recorded webm (screen + mic voiceover), or null. */
  stop: () => Promise<Blob | null>;
  cancel: () => void;
}

export interface LiveClick {
  x: number;
  y: number;
  viewport: { w: number; h: number };
}

export interface CropRegion {
  rect: AreaRect;
  viewport: { w: number; h: number };
}

export interface StartOptions {
  mic: boolean;
  source: CaptureDefaults["source"];
  quality: CaptureDefaults["quality"];
  /** Draw a highlight ring on each click (current-tab modes only). */
  cursor: boolean;
  /**
   * Crop region for "area"/"element" sources, already chosen by the user (in
   * the panel, before this call) so the screen-share gesture stays fresh.
   */
  crop?: CropRegion | null;
  /** Subscribe to live click coords (for cursor rings). Returns an unsubscribe fn. */
  subscribeClicks?: (cb: (c: LiveClick) => void) => () => void;
  /** Called if the user ends screen sharing from the browser UI. */
  onEnded?: () => void;
}

export class CaptureCancelled extends Error {}

const HEIGHTS: Record<CaptureDefaults["quality"], number> = { "720": 720, "1080": 1080, "1440": 1440 };
const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/**
 * Records the screen (getDisplayMedia) with an optional mic voiceover.
 *
 * For "area"/"element" (and when cursor highlight is on) the frames are piped
 * through a canvas so we can crop to a region and paint click rings; "window"
 * records the raw surface directly. Cropping/rings assume a current-tab capture,
 * since only then do page CSS coordinates map onto the captured frame.
 *
 * Throws CaptureCancelled if the user dismisses the screen-share picker.
 */
export async function startRecording(opts: StartOptions): Promise<ActiveRecorder> {
  const { mic, source, quality, cursor, crop = null, subscribeClicks, onEnded } = opts;
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
    throw new Error("Screen recording isn't supported in this browser.");
  }

  // 1) Screen (required) — opens the browser's surface picker. MUST be the first
  // await after the click, or the user-activation needed by getDisplayMedia expires.
  const videoConstraints: MediaTrackConstraints & { cursor?: string } = {
    frameRate: 30,
    height: { ideal: HEIGHTS[quality] },
    cursor: cursor ? "always" : "motion",
  };
  // Use the standard surface picker for every source. `preferCurrentTab` is
  // unreliable when getDisplayMedia is called from a side panel (it can reject
  // without showing any picker), so we let the user pick the surface — for
  // area/element they should choose "This tab" for the crop to line up.
  const displayOptions = { video: videoConstraints, audio: false } as DisplayMediaStreamOptions;

  let displayStream: MediaStream;
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
  } catch (err) {
    const e = err as DOMException;
    // The user dismissing the picker is a cancel; anything else is a real error
    // we should surface rather than silently swallow.
    if (e?.name === "NotAllowedError" || e?.name === "AbortError") {
      throw new CaptureCancelled(e.message || "Screen share cancelled");
    }
    throw new Error(`Couldn't start screen capture: ${e?.message || String(err)}`, { cause: err });
  }

  // 2) Mic (optional voiceover).
  let micStream: MediaStream | null = null;
  if (mic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      micStream = null; // denied / no device — keep recording video only
    }
  }

  // Mic analyser for the waveform.
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  if (micStream) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
      const node = audioCtx.createAnalyser();
      node.fftSize = 128;
      node.smoothingTimeConstant = 0.7;
      audioCtx.createMediaStreamSource(micStream).connect(node);
      analyser = node;
    } catch {
      analyser = null;
    }
  }

  // Decide pipeline: canvas (crop and/or click rings) vs. raw passthrough.
  const useCanvas = source !== "window" && (Boolean(crop) || cursor);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const chunks: BlobPart[] = [];

  // Resources created by the canvas pipeline, torn down on cleanup.
  let rafId = 0;
  let previewVideo: HTMLVideoElement | null = null;
  let canvasStream: MediaStream | null = null;
  let unsubscribe: (() => void) | null = null;

  let recordStream: MediaStream;
  if (useCanvas) {
    recordStream = await buildCanvasStream();
  } else {
    const tracks = [...displayStream.getVideoTracks(), ...(micStream ? micStream.getAudioTracks() : [])];
    recordStream = new MediaStream(tracks);
  }

  const mr = new MediaRecorder(recordStream, { mimeType: mime });
  mr.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mr.start();

  // User clicked the browser's "Stop sharing".
  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => onEnded?.());

  const cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    unsubscribe?.();
    canvasStream?.getTracks().forEach((t) => t.stop());
    if (previewVideo) {
      previewVideo.srcObject = null;
      previewVideo = null;
    }
    displayStream.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    void audioCtx?.close();
  };

  return {
    displayStream,
    previewStream: useCanvas ? recordStream : displayStream,
    analyser,
    micAvailable: Boolean(micStream),
    setMicEnabled: (enabled) => micStream?.getAudioTracks().forEach((t) => (t.enabled = enabled)),
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        mr.onstop = () => {
          cleanup();
          resolve(chunks.length ? new Blob(chunks, { type: mime }) : null);
        };
        if (mr.state !== "inactive") mr.stop();
        else {
          cleanup();
          resolve(null);
        }
      }),
    cancel: () => {
      try {
        if (mr.state !== "inactive") mr.stop();
      } catch {
        /* ignore */
      }
      cleanup();
    },
  };

  // ── canvas crop + click-ring compositor ─────────────────────────────────
  async function buildCanvasStream(): Promise<MediaStream> {
    const video = document.createElement("video");
    previewVideo = video;
    video.muted = true;
    video.srcObject = displayStream;
    await video.play().catch(() => {});
    // Wait for real dimensions.
    if (!video.videoWidth) {
      await new Promise<void>((res) => {
        video.onloadedmetadata = () => res();
        setTimeout(res, 1000);
      });
    }
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    // Map the picked CSS region onto captured-frame pixels.
    const refW = crop?.viewport.w || vw;
    const refH = crop?.viewport.h || vh;
    const sx = vw / refW;
    const sy = vh / refH;

    let cropPx = { x: 0, y: 0, w: vw, h: vh };
    if (crop) {
      const r: AreaRect = crop.rect;
      cropPx = {
        x: Math.max(0, Math.round(r.x * sx)),
        y: Math.max(0, Math.round(r.y * sy)),
        w: Math.min(vw, Math.round(r.w * sx)),
        h: Math.min(vh, Math.round(r.h * sy)),
      };
    }
    const canvas = document.createElement("canvas");
    canvas.width = even(cropPx.w);
    canvas.height = even(cropPx.h);
    const ctx = canvas.getContext("2d")!;

    // Active click rings (canvas-space center + start time).
    const rings: { cx: number; cy: number; born: number }[] = [];
    if (cursor && subscribeClicks) {
      unsubscribe = subscribeClicks((c) => {
        const fx = (c.x * (vw / c.viewport.w)) - cropPx.x;
        const fy = (c.y * (vh / c.viewport.h)) - cropPx.y;
        rings.push({ cx: fx, cy: fy, born: performance.now() });
      });
    }

    const RING_MS = 650;
    const draw = () => {
      ctx.drawImage(video, cropPx.x, cropPx.y, cropPx.w, cropPx.h, 0, 0, canvas.width, canvas.height);
      const now = performance.now();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]!;
        const t = (now - r.born) / RING_MS;
        if (t >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const radius = 8 + t * 26;
        ctx.beginPath();
        ctx.arc(r.cx, r.cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(109,94,252,${(1 - t) * 0.9})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    const stream = canvas.captureStream(30);
    if (micStream) micStream.getAudioTracks().forEach((t) => stream.addTrack(t));
    canvasStream = stream;
    return stream;
  }
}
