export interface ActiveRecorder {
  /** Live screen stream — bind to a <video> for the preview. */
  displayStream: MediaStream;
  /** Mic frequency analyser for the waveform. Null if mic unavailable/denied. */
  analyser: AnalyserNode | null;
  /** True if a mic track was acquired. */
  micAvailable: boolean;
  setMicEnabled: (enabled: boolean) => void;
  /** Returns the recorded webm (screen + mic voiceover), or null. */
  stop: () => Promise<Blob | null>;
  cancel: () => void;
}

export interface StartOptions {
  mic: boolean;
  /** Called if the user ends screen sharing from the browser UI. */
  onEnded?: () => void;
}

export class CaptureCancelled extends Error {}

/**
 * Records the screen (getDisplayMedia) with an optional mic voiceover.
 * Throws CaptureCancelled if the user dismisses the screen-share picker.
 */
export async function startRecording({ mic, onEnded }: StartOptions): Promise<ActiveRecorder> {
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
    throw new Error("Screen recording isn't supported in this browser.");
  }

  // 1) Screen (required) — opens the browser's surface picker.
  let displayStream: MediaStream;
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
  } catch (err) {
    throw new CaptureCancelled((err as Error)?.message ?? "Screen share cancelled");
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

  const tracks = [...displayStream.getVideoTracks(), ...(micStream ? micStream.getAudioTracks() : [])];
  const combined = new MediaStream(tracks);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const chunks: BlobPart[] = [];
  const mr = new MediaRecorder(combined, { mimeType: mime });
  mr.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mr.start();

  // User clicked the browser's "Stop sharing".
  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => onEnded?.());

  const cleanup = () => {
    displayStream.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    void audioCtx?.close();
  };

  return {
    displayStream,
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
}
