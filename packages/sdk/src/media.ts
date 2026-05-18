/** Voice capture (MediaRecorder, no deps). Screenshot/screen-recording are
 * later Phase 5 sub-steps (§14). */
export interface VoiceRecorder {
  stop(): Promise<Blob>;
  cancel(): void;
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
