/** Voice + screen capture (MediaRecorder, no deps). */
export interface VoiceRecorder {
  stop(): Promise<Blob>;
  cancel(): void;
}

export interface ScreenRecording {
  /** Display capture (with narration muxed in) for human review + ticket link. */
  video: Blob;
  /** Mic-only track so transcription reuses the voice pipeline (§14). */
  audio: Blob | null;
}

export interface ScreenRecorder {
  stop(): Promise<ScreenRecording>;
  cancel(): void;
}

function recorderToBlob(rec: MediaRecorder, fallbackType: string): Promise<Blob> {
  const chunks: Blob[] = [];
  rec.ondataavailable = (e: BlobEvent) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || fallbackType }));
  });
  rec.start();
  return done;
}

/**
 * Screen recording: display stream (+ mic muxed for a watchable video) AND a
 * SEPARATE mic-only recorder so the audio can be transcribed directly without
 * server-side extraction (§14). Mic is best-effort — video still works if the
 * user blocks the microphone.
 */
export async function startScreenRecording(): Promise<ScreenRecorder> {
  const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
  let mic: MediaStream | null = null;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    mic = null;
  }

  const videoTracks = display.getVideoTracks();
  const muxed = new MediaStream(videoTracks);
  if (mic) for (const t of mic.getAudioTracks()) muxed.addTrack(t);

  const videoRec = new MediaRecorder(muxed);
  const videoDone = recorderToBlob(videoRec, "video/webm");

  let audioRec: MediaRecorder | null = null;
  let audioDone: Promise<Blob> | null = null;
  if (mic) {
    audioRec = new MediaRecorder(new MediaStream(mic.getAudioTracks()));
    audioDone = recorderToBlob(audioRec, "audio/webm");
  }

  const stopTracks = (): void => {
    display.getTracks().forEach((t) => t.stop());
    mic?.getTracks().forEach((t) => t.stop());
  };

  return {
    stop: async (): Promise<ScreenRecording> => {
      const vp = videoDone;
      const ap = audioDone;
      videoRec.stop();
      audioRec?.stop();
      const video = await vp;
      const audio = ap ? await ap : null;
      stopTracks();
      return { video, audio };
    },
    cancel: () => {
      try {
        videoRec.stop();
        audioRec?.stop();
      } catch {
        /* already stopped */
      }
      stopTracks();
    },
  };
}

export async function startVoiceRecording(): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e: BlobEvent) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start();
  const stopTracks = (): void => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stopTracks();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        };
        rec.stop();
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      stopTracks();
    },
  };
}
