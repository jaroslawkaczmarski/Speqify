import type { CSSProperties, ReactNode } from "react";
import { Icons } from "@speqify/ui";
import { useSettings, type CaptureDefaults } from "@/store";
import { Toggle } from "./controls";

type Source = CaptureDefaults["source"];

function SourceOption({
  icon,
  label,
  desc,
  sel,
  onClick,
  badge,
}: {
  icon: ReactNode;
  label: string;
  desc: string;
  sel: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface)",
        border: `1px solid ${sel ? "var(--sp-indigo-300)" : "var(--sp-border)"}`,
        boxShadow: sel ? "0 0 0 3px var(--sp-indigo-100)" : "none",
        transition: "all .12s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: sel ? "var(--sp-indigo-100)" : "var(--sp-surface-2)",
          color: sel ? "var(--sp-indigo-700)" : "var(--sp-text-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
          {badge && (
            <span className="sp-chip sp-chip-indigo" style={{ height: 16, fontSize: 9.5, padding: "0 5px" }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--sp-text-3)", marginTop: 2 }}>{desc}</div>
      </div>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          border: `2px solid ${sel ? "var(--sp-indigo-600)" : "var(--sp-border-2)"}`,
          background: sel ? "var(--sp-indigo-600)" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {sel && <div style={{ width: 6, height: 6, borderRadius: 999, background: "#fff" }} />}
      </div>
    </button>
  );
}

const rowS: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "12px 0" };

export function SourcePicker({ onStart, onCancel }: { onStart: () => void; onCancel: () => void }) {
  const { capture, setCapture } = useSettings();
  const setSource = (source: Source) => setCapture({ source });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 650, letterSpacing: "-0.01em" }}>What do you want to record?</div>
        <div style={{ fontSize: 12.5, color: "var(--sp-text-3)", marginTop: 4, marginBottom: 14 }}>
          Pick a source, choose your options, then start the recording.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SourceOption sel={capture.source === "area"} onClick={() => setSource("area")} icon={<Icons.Crop size={18} />} label="Custom area" desc="Drag a region of this tab. Best for focused bug repros." badge="recommended" />
          <SourceOption sel={capture.source === "element"} onClick={() => setSource("element")} icon={<Icons.Crosshair size={18} />} label="Element" desc="Click a DOM element — Speqify follows it as it scrolls or animates." />
          <SourceOption sel={capture.source === "tab"} onClick={() => setSource("tab")} icon={<Icons.Image size={18} />} label="Current tab" desc="The whole browser tab including any chrome inside the page." />
          <SourceOption sel={capture.source === "window"} onClick={() => setSource("window")} icon={<Icons.Layers size={18} />} label="Window or screen" desc="Anything on your desktop — for cross-app bug demos." />
        </div>

        <SectionLabel>Options</SectionLabel>
        <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10, padding: "4px 12px" }}>
          <label style={rowS}>
            <Icons.Mic size={14} style={{ color: "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Record voice over</div>
              <div style={{ fontSize: 10.5, color: "var(--sp-text-3)" }}>Narrate while you reproduce. Transcribed automatically.</div>
            </div>
            <Toggle on={capture.mic} onChange={(mic) => setCapture({ mic })} />
          </label>
          <label style={{ ...rowS, borderTop: "1px solid var(--sp-border)" }}>
            <Icons.Crosshair size={14} style={{ color: "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Highlight cursor</div>
              <div style={{ fontSize: 10.5, color: "var(--sp-text-3)" }}>Adds a ring around clicks for clarity.</div>
            </div>
            <Toggle on={capture.cursor} onChange={(cursor) => setCapture({ cursor })} />
          </label>
          <div style={{ ...rowS, borderTop: "1px solid var(--sp-border)" }}>
            <Icons.Globe size={14} style={{ color: "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Quality</div>
              <div style={{ fontSize: 10.5, color: "var(--sp-text-3)" }}>1080p, 30 fps · ~3 MB per minute</div>
            </div>
            <select
              className="sp-input"
              style={{ width: 96, height: 28, padding: "0 6px", fontSize: 11 }}
              value={capture.quality}
              onChange={(e) => setCapture({ quality: e.target.value as CaptureDefaults["quality"] })}
            >
              <option value="720">720p</option>
              <option value="1080">1080p</option>
              <option value="1440">1440p</option>
            </select>
          </div>
        </div>

        <SectionLabel>Add-ons</SectionLabel>
        <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10, padding: "4px 12px" }}>
          <label style={rowS}>
            <Icons.Bolt size={14} style={{ color: capture.repro ? "#7C3AED" : "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Record reproduction steps</span>
                <span className="sp-chip" style={{ height: 16, fontSize: 9.5, padding: "0 5px" }}>Default on</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--sp-text-3)" }}>Captures every click, input & URL change as a replayable timeline.</div>
            </div>
            <Toggle on={capture.repro} onChange={(repro) => setCapture({ repro })} />
          </label>
        </div>
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--sp-border)", display: "flex", gap: 8, background: "var(--sp-surface)" }}>
        <button onClick={onCancel} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
        <button onClick={onStart} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} /> Start recording
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 18, marginBottom: 8 }}>
      {children}
    </div>
  );
}
