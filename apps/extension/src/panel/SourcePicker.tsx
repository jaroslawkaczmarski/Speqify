import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Icons } from "@speqify/ui";
import { useSettings, type CaptureDefaults } from "@/store";
import { Toggle } from "./controls";

type Source = CaptureDefaults["source"];

/** Live microphone-permission state. "unknown" when the Permissions API is absent
 *  (don't lock the toggle then — recording falls back to video-only gracefully). */
function useMicPermission(): string {
  const [state, setState] = useState<string>("unknown");
  useEffect(() => {
    const perms = (navigator as Navigator & {
      permissions?: { query?: (d: { name: PermissionName }) => Promise<PermissionStatus> };
    }).permissions;
    let status: PermissionStatus | undefined;
    perms
      ?.query?.({ name: "microphone" as PermissionName })
      .then((p) => {
        status = p;
        setState(p.state);
        p.onchange = () => setState(p.state);
      })
      .catch(() => setState("unknown"));
    return () => {
      if (status) status.onchange = null;
    };
  }, []);
  return state;
}

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
        gap: 14,
        padding: 14,
        borderRadius: 12,
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
          width: 43,
          height: 43,
          borderRadius: 10,
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
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{label}</span>
          {badge && (
            <span className="sp-chip sp-chip-indigo" style={{ height: 19, fontSize: 11, padding: "0 6px" }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 2 }}>{desc}</div>
      </div>
      <div
        style={{
          width: 19,
          height: 19,
          borderRadius: 1199,
          border: `2px solid ${sel ? "var(--sp-indigo-600)" : "var(--sp-border-2)"}`,
          background: sel ? "var(--sp-indigo-600)" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {sel && <div style={{ width: 7, height: 7, borderRadius: 1199, background: "#fff" }} />}
      </div>
    </button>
  );
}

const rowS: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "14px 0" };

const navBtnS: CSSProperties = {
  width: 43,
  height: 43,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sp-surface)",
  border: "1px solid var(--sp-border)",
  cursor: "pointer",
  color: "var(--sp-text-2)",
  flexShrink: 0,
};

export function SourcePicker({
  onStart,
  onCancel,
  onDrafts,
  onSettings,
  draftsCount = 0,
  error,
  aiNotReady,
}: {
  onStart: () => void;
  onCancel: () => void;
  onDrafts: () => void;
  onSettings: (section?: string) => void;
  draftsCount?: number;
  error?: string | null;
  aiNotReady?: string | null;
}) {
  const { capture, setCapture } = useSettings();
  const setSource = (source: Source) => setCapture({ source });
  const micPerm = useMicPermission();
  // Chrome can't prompt for the mic from the side panel, so "prompt"/"denied" both
  // mean unusable here. "unknown" (no Permissions API) → don't lock, let it try.
  const micUsable = micPerm === "granted" || micPerm === "unknown";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: 19 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 17 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-0.01em" }}>What do you want to record?</div>
            <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 5 }}>
              Pick a source, choose your options, then start the recording.
            </div>
          </div>
          <button onClick={onDrafts} title="Drafts" style={{ ...navBtnS, position: "relative" }}>
            <Icons.Edit size={22} />
            {draftsCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "var(--sp-indigo-600)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  padding: "2px 5px",
                  minWidth: 18,
                  height: 18,
                  borderRadius: 1199,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1.5px solid var(--sp-bg)",
                }}
              >
                {draftsCount}
              </span>
            )}
          </button>
          <button onClick={() => onSettings()} title="Settings" style={navBtnS}>
            <Icons.Cog size={22} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--sp-danger-bg)", border: "1px solid #FECACA", color: "var(--sp-danger)", fontSize: 14 }}>
            {error}
          </div>
        )}

        {aiNotReady && (
          <button
            onClick={() => onSettings("voice")}
            style={{ width: "100%", textAlign: "left", marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #F59E0B", color: "#7C2D12", fontSize: 14, lineHeight: 1.45, cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
          >
            <Icons.Cog size={17} style={{ flexShrink: 0, marginTop: 1, color: "#B45309" }} />
            <span>
              {aiNotReady}{" "}
              <u style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Open Voice &amp; AI settings →</u>
            </span>
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SourceOption sel={capture.source === "area"} onClick={() => setSource("area")} icon={<Icons.Crop size={22} />} label="Custom area" desc="Drag a region of this tab; the recording is cropped to it." badge="recommended" />
          <SourceOption sel={capture.source === "element"} onClick={() => setSource("element")} icon={<Icons.Crosshair size={22} />} label="Element" desc="Click a DOM element to crop the recording to it." />
          <SourceOption sel={capture.source === "tab"} onClick={() => setSource("tab")} icon={<Icons.Image size={22} />} label="Current tab" desc="The whole browser tab. Click rings drawn when cursor highlight is on." />
          <SourceOption sel={capture.source === "window"} onClick={() => setSource("window")} icon={<Icons.Layers size={22} />} label="Window or screen" desc="Anything on your desktop — for cross-app bug demos." />
        </div>

        {(capture.source === "area" || capture.source === "element") && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)", color: "var(--sp-indigo-700)", fontSize: 14, lineHeight: 1.45 }}>
            In the share prompt, choose <b>This tab</b> — the crop lines up with the page you're on.
          </div>
        )}

        <SectionLabel>Options</SectionLabel>
        <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, padding: "5px 14px" }}>
          <label style={{ ...rowS, cursor: micUsable ? undefined : "default" }}>
            <Icons.Mic size={17} style={{ color: micUsable ? "var(--sp-text-3)" : "var(--sp-text-4)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: micUsable ? undefined : "var(--sp-text-3)" }}>Record voice over</div>
              {micUsable ? (
                <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>Narrate while you reproduce. Transcribed automatically.</div>
              ) : (
                <div style={{ fontSize: 13, color: "#B45309" }}>
                  Microphone access not granted.{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onSettings("voice");
                    }}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--sp-indigo-600)", fontWeight: 600, textDecoration: "underline", font: "inherit" }}
                  >
                    Allow in Settings
                  </button>
                </div>
              )}
            </div>
            <Toggle on={micUsable && capture.mic} onChange={(mic) => setCapture({ mic })} disabled={!micUsable} />
          </label>
          <label style={{ ...rowS, borderTop: "1px solid var(--sp-border)" }}>
            <Icons.Crosshair size={17} style={{ color: "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Highlight cursor</div>
              <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>Adds a ring around clicks for clarity.</div>
            </div>
            <Toggle on={capture.cursor} onChange={(cursor) => setCapture({ cursor })} />
          </label>
          <div style={{ ...rowS, borderTop: "1px solid var(--sp-border)" }}>
            <Icons.Globe size={17} style={{ color: "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Quality</div>
              <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>1080p, 30 fps · ~3 MB per minute</div>
            </div>
            <select
              className="sp-input"
              style={{ width: 115, height: 34, padding: "0 7px", fontSize: 13 }}
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
        <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, padding: "5px 14px" }}>
          <label style={rowS}>
            <Icons.Bolt size={17} style={{ color: capture.repro ? "#7C3AED" : "var(--sp-text-3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Record reproduction steps</span>
                <span className="sp-chip" style={{ height: 19, fontSize: 11, padding: "0 6px" }}>Default on</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>Captures every click, input & URL change as a replayable timeline.</div>
            </div>
            <Toggle on={capture.repro} onChange={(repro) => setCapture({ repro })} />
          </label>
        </div>
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", display: "flex", gap: 10, background: "var(--sp-surface)" }}>
        <button onClick={onCancel} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
        <button onClick={onStart} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 1199, background: "#fff" }} /> Start recording
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 22, marginBottom: 10 }}>
      {children}
    </div>
  );
}
