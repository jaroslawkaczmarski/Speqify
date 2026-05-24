import { useState } from "react";
import { Icons, Trackers } from "@speqify/ui";
import type { Ticket, TicketType, TrackerKind } from "@speqify/core";

const TYPE_OPTS: { id: TicketType; label: string; color: string; bg: string }[] = [
  { id: "bug", label: "Bug", color: "#DC2626", bg: "#FEE2E2" },
  { id: "task", label: "Task", color: "#0369A1", bg: "#E0F2FE" },
  { id: "feature", label: "Feature", color: "#7C3AED", bg: "#EDE9FE" },
];

const LOGO: Record<TrackerKind, (p: { size?: number }) => React.JSX.Element> = {
  github: Trackers.GitHub,
  jira: Trackers.Jira,
  linear: Trackers.Linear,
  gitlab: Trackers.GitLab,
};

function TypePicker({ value, onChange }: { value: TicketType; onChange: (v: TicketType) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--sp-surface-2)", borderRadius: 8, padding: 3, border: "1px solid var(--sp-border)" }}>
      {TYPE_OPTS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            flex: 1,
            padding: "5px 10px",
            borderRadius: 5,
            border: "none",
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 600,
            background: value === o.id ? o.bg : "transparent",
            color: value === o.id ? o.color : "var(--sp-text-3)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {hint && <div style={{ fontSize: 10.5, color: "var(--sp-text-4)", marginLeft: 8 }}>{hint}</div>}
    </div>
  );
}

export function Review({
  draft,
  onChange,
  onSend,
  onBack,
  destination,
  attachment,
  recordingUrl,
}: {
  draft: Ticket;
  onChange: (t: Ticket) => void;
  onSend: () => void;
  onBack: () => void;
  destination: { kind: TrackerKind; name: string; sub: string } | null;
  attachment?: { label: string; sub: string };
  recordingUrl?: string | null;
}) {
  const [labelDraft, setLabelDraft] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const addLabel = () => {
    const v = labelDraft.trim();
    if (v && !draft.labels.includes(v)) onChange({ ...draft, labels: [...draft.labels, v] });
    setLabelDraft("");
  };

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* attachments */}
      <div style={{ padding: "14px 16px 0" }}>
        {recordingUrl && (
          <button
            onClick={() => setShowVideo(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 10, background: "var(--sp-surface-2)", borderRadius: 10, border: "1px solid var(--sp-border)", cursor: "pointer", textAlign: "left", marginBottom: 10 }}
          >
            <div style={{ width: 56, height: 40, borderRadius: 6, background: "#0E0C0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <Icons.Play size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Screen recording</div>
              <div style={{ fontSize: 10.5, color: "var(--sp-text-3)" }}>Click to replay</div>
            </div>
            <Icons.Play size={14} style={{ color: "var(--sp-text-3)" }} />
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "var(--sp-surface-2)", borderRadius: 10, border: "1px solid var(--sp-border)" }}>
          <div style={{ width: 56, height: 40, borderRadius: 6, background: "linear-gradient(180deg,#FFFFFF,#F5F5F4)", border: "1px solid var(--sp-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <svg width="44" height="28" viewBox="0 0 100 60">
              <path d="M0 40 L20 35 L40 38 L60 18 L80 14 L100 36 L100 60 L0 60 Z" fill="#A5B4FC" opacity="0.4" />
              <path d="M0 40 L20 35 L40 38 L60 18 L80 14 L100 36" stroke="#4F46E5" strokeWidth="1.5" fill="none" />
              <circle cx="60" cy="18" r="2.5" fill="#DC2626" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{attachment?.label ?? "Capture attached"}</div>
            <div style={{ fontSize: 10.5, color: "var(--sp-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {attachment?.sub ?? "Screenshot + context"}
            </div>
          </div>
          <span className="sp-chip sp-chip-success" style={{ height: 20, fontSize: 10.5 }}>
            <Icons.Check size={9} stroke={2.4} /> Attached
          </span>
        </div>
      </div>

      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px 16px" }}>
        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="Issue type" />
          <TypePicker value={(["bug", "task", "feature"].includes(draft.type) ? draft.type : "task") as TicketType} onChange={(type) => onChange({ ...draft, type })} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="Title" />
          <input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} className="sp-input" style={{ fontWeight: 600, fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="Description" hint="AI-drafted" />
          <textarea value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} className="sp-textarea" rows={6} style={{ fontSize: 13, lineHeight: 1.5 }} />
        </div>

        <div style={{ marginBottom: 4 }}>
          <FieldLabel label="Labels" hint="Optional" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
            {draft.labels.map((l, i) => (
              <span key={i} className="sp-chip sp-chip-indigo" style={{ paddingRight: 4 }}>
                {l}
                <button
                  onClick={() => onChange({ ...draft, labels: draft.labels.filter((_, j) => j !== i) })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "inline-flex" }}
                >
                  <Icons.X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLabel();
              }
            }}
            placeholder="Add a label, press Enter"
            className="sp-input"
            style={{ fontSize: 12, height: 32, padding: "0 10px" }}
          />
        </div>
      </div>

      {/* footer */}
      <div style={{ borderTop: "1px solid var(--sp-border)", padding: "12px 16px", background: "var(--sp-surface)" }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Destination</div>
        {destination ? (
          (() => {
            const L = LOGO[destination.kind];
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)" }}>
                <L size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{destination.name}</div>
                  <div style={{ fontSize: 11, color: "var(--sp-text-3)" }}>{destination.sub}</div>
                </div>
                <span className="sp-chip sp-chip-success" style={{ height: 20, fontSize: 10.5 }}>
                  <Icons.Check size={10} stroke={2.4} /> From settings
                </span>
              </div>
            );
          })()
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--sp-warn-bg)", border: "1px solid #FDE68A", color: "var(--sp-warn)", fontSize: 12 }}>
            No tracker connected — add one in Settings to create issues.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={onBack} className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Trash size={12} /> Discard
          </button>
          <button onClick={onSend} disabled={!destination || !draft.title.trim()} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
            <Icons.Send size={13} /> Create issue
          </button>
        </div>
      </div>
    </div>

    {showVideo && recordingUrl && (
      <div
        onClick={() => setShowVideo(false)}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%" }}>
          <video src={recordingUrl} controls autoPlay style={{ width: "100%", maxHeight: "78vh", borderRadius: 10, background: "#000" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button onClick={() => window.open(recordingUrl, "_blank")} className="sp-btn sp-btn-secondary sp-btn-sm">
              Open large ↗
            </button>
            <button onClick={() => setShowVideo(false)} className="sp-btn sp-btn-primary sp-btn-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
