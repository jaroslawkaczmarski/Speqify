import { useEffect, useRef, useState } from "react";
import { Icons } from "@speqify/ui";
import { KEYS } from "@/lib/shortcuts";
import { RecordingWaveform, ToggleChip } from "./controls";

export function Recording({
  time,
  analyser,
  displayStream,
  micAvailable = false,
  cursor = false,
  repro = false,
  onStop,
  onCancel,
  onMicChange,
}: {
  time: string;
  analyser?: AnalyserNode | null;
  displayStream?: MediaStream | null;
  micAvailable?: boolean;
  cursor?: boolean;
  repro?: boolean;
  onStop: () => void;
  onCancel: () => void;
  onMicChange?: (on: boolean) => void;
}) {
  const [micOn, setMicOn] = useState(micAvailable);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && displayStream) videoRef.current.srcObject = displayStream;
  }, [displayStream]);

  const toggleMic = () => {
    if (!micAvailable) return;
    setMicOn((o) => {
      const next = !o;
      onMicChange?.(next);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        onStop();
      } else if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--sp-bg)" }}>
      {/* recording banner */}
      <div style={{ background: "#1C1917", color: "#fff", padding: "17px 19px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: 1199, background: "#DC2626", animation: "sp-pulse 1.2s infinite" }} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}>REC</span>
          <span style={{ fontFamily: "var(--sp-mono)", fontSize: 17, fontWeight: 600, marginLeft: 5 }}>{time}</span>
          <div style={{ flex: 1 }} />
          <span className="sp-chip" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", height: 24, fontSize: 13 }}>
            <Icons.Image size={11} /> Screen
          </span>
        </div>
      </div>

      {/* live preview — real screen stream */}
      <div style={{ padding: 17 }}>
        <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", background: "#0E0C0A", border: "1px solid var(--sp-border-2)" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#0E0C0A" }}
          />
          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: 5, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
            <div style={{ width: 7, height: 7, borderRadius: 1199, background: "#DC2626", animation: "sp-pulse 1.2s infinite" }} />
            LIVE
          </div>
        </div>
      </div>

      {/* mic control + waveform, or a not-available notice */}
      <div style={{ padding: "0 17px" }}>
        {micAvailable ? (
          <div
            style={{
              background: micOn ? "#1C1917" : "var(--sp-surface)",
              color: micOn ? "#fff" : "var(--sp-text-2)",
              border: "1px solid",
              borderColor: micOn ? "#1C1917" : "var(--sp-border)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <button
              onClick={toggleMic}
              title={micOn ? "Mute mic" : "Unmute mic"}
              style={{ width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer", background: micOn ? "#DC2626" : "var(--sp-surface-2)", color: micOn ? "#fff" : "var(--sp-text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              {micOn ? <Icons.Mic size={22} /> : <Icons.MicOff size={22} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.85, marginBottom: 5 }}>
                {micOn ? "Microphone live" : "Microphone muted"}
              </div>
              <RecordingWaveform active={micOn} analyser={analyser} color={micOn ? "#fff" : "#A8A29E"} />
            </div>
            <span style={{ fontSize: 13, fontFamily: "var(--sp-mono)", opacity: 0.6 }}>{KEYS.alt} M</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 12, background: "var(--sp-warn-bg)", border: "1px solid #FDE68A", color: "var(--sp-warn)" }}>
            <Icons.MicOff size={19} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 14, lineHeight: 1.45 }}>
              No microphone — recording video only. Allow mic access (lock icon in the address bar), then stop and start again to add a voiceover.
            </div>
          </div>
        )}
      </div>

      {/* active capture add-ons (status, set in the source picker) */}
      {(cursor || repro) && (
        <div style={{ padding: "14px 17px 5px", display: "flex", gap: 10 }}>
          {cursor && <ToggleChip icon={<Icons.Crosshair size={14} />} label="Cursor highlight" on subtle onClick={() => {}} />}
          {repro && <ToggleChip icon={<Icons.Bolt size={14} />} label="Repro steps" on subtle onClick={() => {}} />}
        </div>
      )}

      {/* hint */}
      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 17px 17px" }}>
        <div style={{ padding: 14, background: "var(--sp-surface)", borderRadius: 10, border: "1px solid var(--sp-border)", fontSize: 14, color: "var(--sp-text-2)", lineHeight: 1.55 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
            Recording
          </div>
          {micAvailable
            ? "Walk through the bug and narrate what's happening. We'll transcribe your voice and draft the ticket when you stop."
            : "Reproduce the issue on screen. Add a microphone for an auto-transcribed voiceover."}
        </div>
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)", display: "flex", gap: 10 }}>
        <button onClick={onCancel} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
          <Icons.X size={14} /> Discard
        </button>
        <button onClick={onStop} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center", background: "#DC2626" }}>
          <Icons.Stop size={14} /> Stop &amp; attach
        </button>
      </div>
    </div>
  );
}
