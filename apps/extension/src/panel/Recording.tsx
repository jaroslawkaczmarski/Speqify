import { useEffect, useRef, useState } from "react";
import { Icons } from "@speqify/ui";
import { KEYS } from "@/lib/shortcuts";
import { RecordingWaveform, ToggleChip } from "./controls";

export function Recording({
  time,
  analyser,
  displayStream,
  micAvailable = false,
  onStop,
  onCancel,
  onMicChange,
}: {
  time: string;
  analyser?: AnalyserNode | null;
  displayStream?: MediaStream | null;
  micAvailable?: boolean;
  onStop: () => void;
  onCancel: () => void;
  onMicChange?: (on: boolean) => void;
}) {
  const [micOn, setMicOn] = useState(micAvailable);
  const [cursorOn, setCursorOn] = useState(true);
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
      if (e.altKey && (e.key === "m" || e.key === "M")) {
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
      <div style={{ background: "#1C1917", color: "#fff", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: "#DC2626", animation: "sp-pulse 1.2s infinite" }} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>REC</span>
          <span style={{ fontFamily: "var(--sp-mono)", fontSize: 14, fontWeight: 600, marginLeft: 4 }}>{time}</span>
          <div style={{ flex: 1 }} />
          <span className="sp-chip" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", height: 20, fontSize: 10.5 }}>
            <Icons.Image size={9} /> Screen
          </span>
        </div>
      </div>

      {/* live preview — real screen stream */}
      <div style={{ padding: 14 }}>
        <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 10, overflow: "hidden", background: "#0E0C0A", border: "1px solid var(--sp-border-2)" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#0E0C0A" }}
          />
          <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 4, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 10, fontWeight: 600 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: "#DC2626", animation: "sp-pulse 1.2s infinite" }} />
            LIVE
          </div>
        </div>
      </div>

      {/* mic control + waveform, or a not-available notice */}
      <div style={{ padding: "0 14px" }}>
        {micAvailable ? (
          <div
            style={{
              background: micOn ? "#1C1917" : "var(--sp-surface)",
              color: micOn ? "#fff" : "var(--sp-text-2)",
              border: "1px solid",
              borderColor: micOn ? "#1C1917" : "var(--sp-border)",
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              onClick={toggleMic}
              title={micOn ? "Mute mic" : "Unmute mic"}
              style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer", background: micOn ? "#DC2626" : "var(--sp-surface-2)", color: micOn ? "#fff" : "var(--sp-text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              {micOn ? <Icons.Mic size={18} /> : <Icons.MicOff size={18} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
                {micOn ? "Microphone live" : "Microphone muted"}
              </div>
              <RecordingWaveform active={micOn} analyser={analyser} color={micOn ? "#fff" : "#A8A29E"} />
            </div>
            <span style={{ fontSize: 10.5, fontFamily: "var(--sp-mono)", opacity: 0.6 }}>{KEYS.alt} M</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--sp-warn-bg)", border: "1px solid #FDE68A", color: "var(--sp-warn)" }}>
            <Icons.MicOff size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
              No microphone — recording video only. Allow mic access (lock icon in the address bar), then stop and start again to add a voiceover.
            </div>
          </div>
        )}
      </div>

      {/* quick toggles */}
      <div style={{ padding: "12px 14px 4px", display: "flex", gap: 8 }}>
        <ToggleChip icon={<Icons.Crosshair size={12} />} label="Cursor highlight" on={cursorOn} onClick={() => setCursorOn((o) => !o)} />
        <ToggleChip icon={<Icons.Bolt size={12} />} label="Repro steps" on onClick={() => {}} subtle />
      </div>

      {/* hint */}
      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 14px 14px" }}>
        <div style={{ padding: 12, background: "var(--sp-surface)", borderRadius: 8, border: "1px solid var(--sp-border)", fontSize: 12, color: "var(--sp-text-2)", lineHeight: 1.55 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Recording
          </div>
          {micAvailable
            ? "Walk through the bug and narrate what's happening. We'll transcribe your voice and draft the ticket when you stop."
            : "Reproduce the issue on screen. Add a microphone for an auto-transcribed voiceover."}
        </div>
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)", display: "flex", gap: 8 }}>
        <button onClick={onCancel} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
          <Icons.X size={12} /> Discard
        </button>
        <button onClick={onStop} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center", background: "#DC2626" }}>
          <Icons.Stop size={12} /> Stop &amp; attach
        </button>
      </div>
    </div>
  );
}
