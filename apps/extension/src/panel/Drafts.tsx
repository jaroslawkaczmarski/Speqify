import { Icons } from "@speqify/ui";
import type { DraftRecord } from "./drafts-db";

function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function Drafts({
  drafts,
  onResume,
  onDelete,
  onBack,
}: {
  drafts: DraftRecord[];
  onResume: (rec: DraftRecord) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  if (!drafts.length) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 29, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>No drafts yet</div>
        <div style={{ fontSize: 15, color: "var(--sp-text-3)", maxWidth: 288 }}>
          Captures you save before sending appear here so you can resume them later.
        </div>
        <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={onBack}>
          Back to capture
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: 19 }}>
        <div style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 5 }}>Saved drafts</div>
        <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginBottom: 17 }}>
          Resume a capture to review and create the issue.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {drafts.map((d) => (
            <div
              key={d.id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12 }}
            >
              <div style={{ width: 48, height: 36, borderRadius: 7, background: "#0E0C0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                <Icons.Play size={16} />
              </div>
              <button
                onClick={() => onResume(d)}
                style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>{ago(d.createdAt)}{d.video ? " · video" : ""}</div>
              </button>
              <button onClick={() => onResume(d)} className="sp-btn sp-btn-secondary sp-btn-sm" title="Resume">
                Resume
              </button>
              <button
                onClick={() => onDelete(d.id)}
                title="Delete draft"
                style={{ width: 34, height: 34, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--sp-text-3)" }}
              >
                <Icons.Trash size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <button className="sp-btn sp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={onBack}>
          Back to capture
        </button>
      </div>
    </div>
  );
}
