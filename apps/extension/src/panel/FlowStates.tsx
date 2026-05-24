import { Icons, Trackers } from "@speqify/ui";
import type { TrackerKind } from "@speqify/core";

const LOGO: Record<TrackerKind, (p: { size?: number }) => React.JSX.Element> = {
  github: Trackers.GitHub,
  jira: Trackers.Jira,
  linear: Trackers.Linear,
  gitlab: Trackers.GitLab,
};

export function Transcribing({ step, onCancel }: { step: number; onCancel: () => void }) {
  const steps = [
    { label: "Transcribing audio", icon: <Icons.Wave size={14} /> },
    { label: "Detecting issue type", icon: <Icons.Bug size={14} /> },
    { label: "Drafting the ticket", icon: <Icons.Sparkles size={14} /> },
    { label: "Suggesting labels", icon: <Icons.Check size={14} /> },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-flex", position: "relative", width: 56, height: 56, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", animation: "sp-spin 1.4s linear infinite" }}>
            <circle cx="28" cy="28" r="22" fill="none" stroke="#E0E7FF" strokeWidth="3" />
            <circle cx="28" cy="28" r="22" fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeDasharray="35 200" />
          </svg>
          <Icons.Sparkles size={20} style={{ color: "var(--sp-indigo-600)" }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Speqifying your note…</div>
        <div style={{ fontSize: 12.5, color: "var(--sp-text-3)", marginTop: 4 }}>This takes a few seconds.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: active ? "var(--sp-indigo-50)" : "transparent",
                border: active ? "1px solid var(--sp-indigo-100)" : "1px solid transparent",
                color: done ? "var(--sp-success)" : active ? "var(--sp-indigo-700)" : "var(--sp-text-4)",
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--sp-success-bg)" : active ? "var(--sp-indigo-100)" : "var(--sp-surface-2)" }}>
                {done ? <Icons.Check size={11} stroke={2.4} /> : s.icon}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: done || active ? 600 : 500 }}>{s.label}</div>
              {active && <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--sp-indigo-600)" }}>…</div>}
            </div>
          );
        })}
        </div>
      </div>
      <div style={{ padding: 12, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <button className="sp-btn sp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={onCancel}>
          Cancel
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
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ animation: "sp-spin 1.2s linear infinite" }}>
            <circle cx="28" cy="28" r="22" fill="none" stroke="#E0E7FF" strokeWidth="3" />
            <circle cx="28" cy="28" r="22" fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeDasharray="55 200" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <L size={22} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Creating issue in {name}…</div>
          <div style={{ fontSize: 12.5, color: "var(--sp-text-3)", marginTop: 4 }}>{sub}</div>
        </div>
      </div>
      <div style={{ padding: 12, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
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
    <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--sp-success-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sp-success)" }}>
          <Icons.Check size={28} stroke={2.4} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Issue created</div>
          <div style={{ fontSize: 12.5, color: "var(--sp-text-3)", marginTop: 4 }}>Sent to {name} · {sub}</div>
        </div>

        <button
          onClick={open}
          style={{ width: "100%", padding: 12, background: "var(--sp-surface-2)", borderRadius: 10, border: "1px solid var(--sp-border)", display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: url ? "pointer" : "default" }}
        >
          <L size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--sp-text-3)", fontFamily: "var(--sp-mono)" }}>{issueKey}</div>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          </div>
          <Icons.Arrow size={14} style={{ color: "var(--sp-text-3)" }} />
        </button>

        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <button onClick={() => url && navigator.clipboard?.writeText(url)} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Copy size={13} /> Copy link
          </button>
          <button onClick={open} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Arrow size={13} /> Open
          </button>
        </div>
      </div>

      <button onClick={onNew} className="sp-btn sp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
        <Icons.Plus size={14} /> Capture another
      </button>
    </div>
  );
}
