import { Icons, Trackers } from "@speqify/ui";
import type { TrackerKind } from "@speqify/core";
import { RecordingWaveform } from "./controls";

const LOGO: Record<TrackerKind, (p: { size?: number }) => React.JSX.Element> = {
  github: Trackers.GitHub,
  jira: Trackers.Jira,
  linear: Trackers.Linear,
  gitlab: Trackers.GitLab,
};

export type TranscribePhase = "transcribe" | "draft";

export function Transcribing({ phase, onCancel }: { phase: TranscribePhase; onCancel: () => void }) {
  const steps: { key: TranscribePhase; label: string; sub: string; icon: React.JSX.Element }[] = [
    { key: "transcribe", label: "Transcribing your voice note", sub: "Speech → text (skipped if you didn't record audio)", icon: <Icons.Wave size={17} /> },
    { key: "draft", label: "Drafting the ticket", sub: "Title, description, type & labels from the transcript + page context", icon: <Icons.Sparkles size={17} /> },
  ];
  const idx = steps.findIndex((s) => s.key === phase);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", position: "relative", width: 67, height: 67, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", animation: "sp-spin 1.4s linear infinite" }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="#E0E7FF" strokeWidth="3" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeDasharray="35 200" />
            </svg>
            <Icons.Sparkles size={24} style={{ color: "var(--sp-indigo-600)" }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{steps[idx]?.label ?? "Speqifying your note…"}</div>
          <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 5 }}>
            Local models can take a little longer on the first run.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 5 }}>
          {steps.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <div
                key={s.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: active ? "var(--sp-indigo-50)" : "transparent",
                  border: active ? "1px solid var(--sp-indigo-100)" : "1px solid transparent",
                  color: done ? "var(--sp-success)" : active ? "var(--sp-indigo-700)" : "var(--sp-text-4)",
                }}
              >
                <div style={{ width: 22, height: 22, borderRadius: 1199, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: done ? "var(--sp-success-bg)" : active ? "var(--sp-indigo-100)" : "var(--sp-surface-2)" }}>
                  {done ? <Icons.Check size={13} stroke={2.4} /> : s.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: done || active ? 600 : 500 }}>{s.label}</div>
                  {active && <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 1 }}>{s.sub}</div>}
                </div>
                {active && (
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ marginLeft: "auto", flexShrink: 0, animation: "sp-spin 0.9s linear infinite" }}>
                    <circle cx="8" cy="8" r="6" fill="none" stroke="var(--sp-indigo-100)" strokeWidth="2" />
                    <circle cx="8" cy="8" r="6" fill="none" stroke="var(--sp-indigo-600)" strokeWidth="2" strokeLinecap="round" strokeDasharray="10 40" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <button className="sp-btn sp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Recording a mic-only voice note (the Screenshot flow's "dictate" input). */
export function VoiceNote({
  time,
  analyser,
  onStop,
  onCancel,
}: {
  time: string;
  analyser?: AnalyserNode | null;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "#1C1917", color: "#fff", padding: "17px 19px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 12, height: 12, borderRadius: 1199, background: "#DC2626", animation: "sp-pulse 1.2s infinite" }} />
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}>REC</span>
        <span style={{ fontFamily: "var(--sp-mono)", fontSize: 17, fontWeight: 600, marginLeft: 5 }}>{time}</span>
        <div style={{ flex: 1 }} />
        <span className="sp-chip" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", height: 24, fontSize: 13 }}>
          <Icons.Mic size={11} /> Voice note
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 20, padding: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 1199, background: "var(--sp-danger-bg)", color: "var(--sp-danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icons.Mic size={32} />
        </div>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <RecordingWaveform active analyser={analyser} color="#DC2626" />
        </div>
        <div style={{ textAlign: "center", fontSize: 15, color: "var(--sp-text-3)", lineHeight: 1.5 }}>
          Describe the issue out loud — we'll transcribe it and draft the ticket when you stop.
        </div>
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)", display: "flex", gap: 10 }}>
        <button onClick={onCancel} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
          <Icons.X size={14} /> Discard
        </button>
        <button onClick={onStop} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center", background: "#DC2626" }}>
          <Icons.Stop size={14} /> Stop &amp; draft
        </button>
      </div>
    </div>
  );
}

export function Sending({
  kind,
  name,
  sub,
  onCancel,
}: {
  kind: TrackerKind;
  name: string;
  sub: string;
  onCancel: () => void;
}) {
  const L = LOGO[kind];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, padding: 29, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 17 }}>
        <div style={{ position: "relative", width: 67, height: 67 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ animation: "sp-spin 1.2s linear infinite" }}>
            <circle cx="28" cy="28" r="22" fill="none" stroke="#E0E7FF" strokeWidth="3" />
            <circle cx="28" cy="28" r="22" fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeDasharray="55 200" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <L size={26} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Creating issue in {name}…</div>
          <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 5 }}>{sub}</div>
        </div>
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <button className="sp-btn sp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Success({
  kind,
  name,
  sub,
  issueKey,
  url,
  title,
  onNew,
}: {
  kind: TrackerKind;
  name: string;
  sub: string;
  issueKey: string;
  url: string;
  title: string;
  onNew: () => void;
}) {
  const L = LOGO[kind];
  const open = () => url && window.open(url, "_blank", "noopener");
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 17 }}>
        <div style={{ width: 67, height: 67, borderRadius: 1199, background: "var(--sp-success-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sp-success)" }}>
          <Icons.Check size={34} stroke={2.4} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Issue created</div>
          <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 5 }}>Sent to {name} · {sub}</div>
        </div>

        <button
          onClick={open}
          style={{ width: "100%", padding: 14, background: "var(--sp-surface-2)", borderRadius: 12, border: "1px solid var(--sp-border)", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: url ? "pointer" : "default" }}
        >
          <L size={24} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--sp-text-3)", fontFamily: "var(--sp-mono)" }}>{issueKey}</div>
            <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          </div>
          <Icons.Arrow size={17} style={{ color: "var(--sp-text-3)" }} />
        </button>

        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={() => url && navigator.clipboard?.writeText(url)} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Copy size={16} /> Copy link
          </button>
          <button onClick={open} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Arrow size={16} /> Open
          </button>
        </div>
      </div>

      <button onClick={onNew} className="sp-btn sp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
        <Icons.Plus size={17} /> Capture another
      </button>
    </div>
  );
}
