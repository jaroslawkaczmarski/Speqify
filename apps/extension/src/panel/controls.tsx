import { useEffect, useRef, type ReactNode } from "react";

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        background: on ? "var(--sp-indigo-600)" : "var(--sp-border-2)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background .15s",
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          transition: "left .15s",
        }}
      />
    </button>
  );
}

export function ToggleChip({
  icon,
  label,
  on,
  onClick,
  subtle,
}: {
  icon: ReactNode;
  label: string;
  on: boolean;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        cursor: "pointer",
        background: on ? (subtle ? "var(--sp-surface-2)" : "var(--sp-indigo-50)") : "transparent",
        border: "1px solid",
        borderColor: on ? (subtle ? "var(--sp-border)" : "var(--sp-indigo-200)") : "var(--sp-border)",
        color: on ? (subtle ? "var(--sp-text-2)" : "var(--sp-indigo-700)") : "var(--sp-text-3)",
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      {icon} {label}
      <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{on ? "on" : "off"}</span>
    </button>
  );
}

/**
 * Live waveform driven by the real microphone (Web Audio AnalyserNode).
 * Bars move with your voice. Falls back to a flat line when muted or when no
 * analyser is available (e.g. mic denied).
 */
export function RecordingWaveform({
  active,
  analyser = null,
  color = "#fff",
  bars = 32,
  height = 22,
}: {
  active: boolean;
  analyser?: AnalyserNode | null;
  color?: string;
  bars?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const step = data ? Math.max(1, Math.floor(data.length / bars)) : 1;
    let raf = 0;

    const draw = () => {
      if (active && analyser && data) {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < children.length; i++) {
          const v = (data[i * step] ?? 0) / 255; // 0..1
          children[i].style.height = `${Math.max(3, Math.min(height, v * height * 1.6))}px`;
          children[i].style.opacity = "0.9";
        }
      } else {
        for (const c of children) {
          c.style.height = "3px";
          c.style.opacity = "0.3";
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, analyser, bars, height]);

  return (
    <div ref={containerRef} style={{ display: "flex", alignItems: "center", gap: 2, height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{ width: 2, height: 3, background: color, opacity: 0.3, borderRadius: 1, transition: "height .06s linear" }}
        />
      ))}
    </div>
  );
}
