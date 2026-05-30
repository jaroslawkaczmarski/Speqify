import { useRef, useState } from "react";
import { Icons, Trackers } from "@speqify/ui";
import { describeStep, SCREENSHOT_EMBED, type CaptureContext, type Ticket, type TicketType, type TrackerKind } from "@speqify/core";

export type IncludeFlags = { errors: boolean; network: boolean; steps: boolean };

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
    <div style={{ display: "flex", gap: 5, background: "var(--sp-surface-2)", borderRadius: 10, padding: 4, border: "1px solid var(--sp-border)" }}>
      {TYPE_OPTS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 14,
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
    <div style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {hint && <div style={{ fontSize: 13, color: "var(--sp-text-4)", marginLeft: 10 }}>{hint}</div>}
    </div>
  );
}

/** Captured technical context (console/JS errors, failed requests, repro steps),
 *  shown read-only with per-group include toggles. The issue body already embeds
 *  these via composeMarkdown/composeAdf; unchecking filters a group out before submit. */
function CapturedContext({ ctx, include, onInclude }: { ctx: CaptureContext; include: IncludeFlags; onInclude: (i: IncludeFlags) => void }) {
  const [open, setOpen] = useState(false);
  const consoleErrs = ctx.console.filter((c) => c.level === "error" || c.level === "warn");
  const failed = ctx.network.filter((n) => !n.ok);
  const steps = ctx.steps ?? [];
  const errCount = consoleErrs.length + ctx.errors.length;
  if (!errCount && !failed.length && !steps.length) return null;
  const t0 = steps[0]?.at ?? 0;
  const rel = (at: number) => {
    const s = Math.max(0, Math.round((at - t0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const chk = (on: boolean, set: (v: boolean) => void, label: string, n: number) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", padding: "3px 0" }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{label} <span style={{ color: "var(--sp-text-4)" }}>({n})</span></span>
    </label>
  );
  return (
    <div style={{ marginBottom: 17, border: "1px solid var(--sp-border)", borderRadius: 10, padding: "10px 12px", background: "var(--sp-surface)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <Icons.Bug size={14} style={{ color: "var(--sp-text-3)" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Captured context</span>
        <Icons.Arrow size={14} style={{ color: "var(--sp-text-3)", marginLeft: "auto", transform: open ? "rotate(90deg)" : "none" }} />
      </button>
      <div style={{ marginTop: 6 }}>
        {errCount > 0 && chk(include.errors, (v) => onInclude({ ...include, errors: v }), "Console & JS errors", errCount)}
        {failed.length > 0 && chk(include.network, (v) => onInclude({ ...include, network: v }), "Failed requests", failed.length)}
        {steps.length > 0 && chk(include.steps, (v) => onInclude({ ...include, steps: v }), "Reproduction steps", steps.length)}
      </div>
      {open && (
        <div style={{ marginTop: 8, fontFamily: "var(--sp-mono)", fontSize: 12.5, lineHeight: 1.5, color: "var(--sp-text-2)", display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {include.errors && errCount > 0 && (
            <div>
              {ctx.errors.slice(-8).map((e, i) => (
                <div key={`je${i}`} style={{ color: "var(--sp-danger)" }}>⚠ {e.message}</div>
              ))}
              {consoleErrs.slice(-8).map((c, i) => (
                <div key={`c${i}`} style={{ color: c.level === "error" ? "var(--sp-danger)" : "var(--sp-warn)" }}>[{c.level}] {c.message}</div>
              ))}
            </div>
          )}
          {include.network && failed.length > 0 && (
            <div>
              {failed.slice(-8).map((n, i) => (
                <div key={`n${i}`}>
                  {n.status} {n.method} {n.url}
                </div>
              ))}
            </div>
          )}
          {include.steps && steps.length > 0 && (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
              {steps.map((s, i) => (
                <li key={`s${i}`} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--sp-text-4)", width: 38, flexShrink: 0 }}>{rel(s.at)}</span>
                  <span>{describeStep(s)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export function Review({
  draft,
  onChange,
  onSend,
  onBack,
  onSaveDraft,
  destination,
  attachment,
  recordingUrl,
  videoSupported,
  includeVideo,
  onIncludeVideo,
  context,
  include,
  onInclude,
  onSettings,
}: {
  draft: Ticket;
  onChange: (t: Ticket) => void;
  onSend: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
  destination: { kind: TrackerKind; name: string; sub: string } | null;
  attachment?: { label: string; sub: string };
  recordingUrl?: string | null;
  videoSupported?: boolean;
  includeVideo?: boolean;
  onIncludeVideo?: (v: boolean) => void;
  context?: CaptureContext;
  include: IncludeFlags;
  onInclude: (i: IncludeFlags) => void;
  onSettings?: (section?: string) => void;
}) {
  const screenshot = context?.screenshot;
  const [labelDraft, setLabelDraft] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const [showShot, setShowShot] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const addLabel = () => {
    const v = labelDraft.trim();
    if (v && !draft.labels.includes(v)) onChange({ ...draft, labels: [...draft.labels, v] });
    setLabelDraft("");
  };

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* attachments */}
      <div style={{ padding: "17px 19px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {recordingUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => setShowVideo(true)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--sp-surface-2)", borderRadius: 12, border: "1px solid var(--sp-border)", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 67, height: 48, borderRadius: 7, background: "#0E0C0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                <Icons.Play size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Screen recording</div>
                <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>Click to replay</div>
              </div>
              <Icons.Play size={17} style={{ color: "var(--sp-text-3)" }} />
            </button>
            {videoSupported ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--sp-text-2)", cursor: "pointer", paddingLeft: 2 }}>
                <input type="checkbox" checked={includeVideo ?? true} onChange={(e) => onIncludeVideo?.(e.target.checked)} />
                <span>Attach the recording to the issue</span>
              </label>
            ) : (
              <div style={{ fontSize: 13, color: "var(--sp-text-3)", paddingLeft: 2 }}>
                Kept in your local draft — {destination?.name ?? "this tracker"} can't host video uploads.
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--sp-surface-2)", borderRadius: 12, border: "1px solid var(--sp-border)" }}>
          <button
            onClick={() => screenshot && setShowShot(true)}
            disabled={!screenshot}
            style={{ width: 67, height: 48, borderRadius: 7, padding: 0, border: "1px solid var(--sp-border)", overflow: "hidden", flexShrink: 0, cursor: screenshot ? "pointer" : "default", background: "linear-gradient(180deg,#FFFFFF,#F5F5F4)" }}
          >
            {screenshot ? (
              <img src={screenshot} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="44" height="28" viewBox="0 0 100 60">
                <path d="M0 40 L20 35 L40 38 L60 18 L80 14 L100 36 L100 60 L0 60 Z" fill="#A5B4FC" opacity="0.4" />
                <path d="M0 40 L20 35 L40 38 L60 18 L80 14 L100 36" stroke="#4F46E5" strokeWidth="1.5" fill="none" />
              </svg>
            )}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{attachment?.label ?? "Page context"}</div>
            <div style={{ fontSize: 13, color: "var(--sp-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {attachment?.sub ?? "URL, console & network errors"}
            </div>
          </div>
          <span className="sp-chip sp-chip-success" style={{ height: 24, fontSize: 13 }}>
            <Icons.Check size={11} stroke={2.4} /> Included
          </span>
        </div>
        {screenshot && (
          <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: -5, paddingLeft: 2 }}>
            {destination && !SCREENSHOT_EMBED[destination.kind]
              ? "Screenshot is a local preview — GitHub's API can't attach images."
              : "Screenshot will be attached to the created issue."}
          </div>
        )}
      </div>

      <div className="sp-scroll" style={{ flex: 1, overflowY: "auto", padding: "17px 19px 19px" }}>
        <div style={{ marginBottom: 17 }}>
          <FieldLabel label="Issue type" />
          <TypePicker value={(["bug", "task", "feature"].includes(draft.type) ? draft.type : "task") as TicketType} onChange={(type) => onChange({ ...draft, type })} />
        </div>

        <div style={{ marginBottom: 17 }}>
          <FieldLabel label="Title" />
          <input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} className="sp-input" style={{ fontWeight: 600, fontSize: 17 }} />
        </div>

        <div style={{ marginBottom: 17 }}>
          <FieldLabel label="Description" hint="AI-drafted" />
          <textarea value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} className="sp-textarea" rows={6} style={{ fontSize: 16, lineHeight: 1.5 }} />
        </div>

        {context && <CapturedContext ctx={context} include={include} onInclude={onInclude} />}

        <div style={{ marginBottom: 5 }}>
          <FieldLabel label="Labels" hint="Optional" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
            {draft.labels.map((l, i) => (
              <span key={i} className="sp-chip sp-chip-indigo" style={{ paddingRight: 5 }}>
                {l}
                <button
                  onClick={() => onChange({ ...draft, labels: draft.labels.filter((_, j) => j !== i) })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "inline-flex" }}
                >
                  <Icons.X size={12} />
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
            style={{ fontSize: 14, height: 38, padding: "0 12px" }}
          />
        </div>
      </div>

      {/* footer */}
      <div style={{ borderTop: "1px solid var(--sp-border)", padding: "14px 19px", background: "var(--sp-surface)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>Destination</div>
        {destination ? (
          (() => {
            const L = LOGO[destination.kind];
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)" }}>
                <L size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{destination.name}</div>
                  <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>{destination.sub}</div>
                </div>
                <span className="sp-chip sp-chip-success" style={{ height: 24, fontSize: 13 }}>
                  <Icons.Check size={12} stroke={2.4} /> From settings
                </span>
              </div>
            );
          })()
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--sp-warn-bg)", border: "1px solid #FDE68A", color: "var(--sp-warn)", fontSize: 14 }}>
            <span>
              No tracker connected — add one in{" "}
              <button
                type="button"
                onClick={() => onSettings?.("integrations")}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}
              >
                Settings
              </button>{" "}
              to create issues.
            </span>
          </div>
        )}
        <button onClick={onSend} disabled={!destination || !draft.title.trim()} className="sp-btn sp-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
          <Icons.Send size={16} /> Create issue
        </button>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={onBack} className="sp-btn sp-btn-ghost sp-btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Trash size={14} /> Discard
          </button>
          <button onClick={onSaveDraft} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Edit size={14} /> Save for later
          </button>
        </div>
      </div>
    </div>

    {showVideo && recordingUrl && (
      <div
        onClick={() => setShowVideo(false)}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%" }}>
          <video ref={videoRef} src={recordingUrl} controls autoPlay style={{ width: "100%", maxHeight: "78vh", borderRadius: 12, background: "#000" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                // Pause the inline preview first — otherwise it keeps playing behind
                // the newly opened tab and two copies play (with audio) at once.
                videoRef.current?.pause();
                window.open(recordingUrl, "_blank");
              }}
              className="sp-btn sp-btn-secondary sp-btn-sm"
            >
              Open large ↗
            </button>
            <button onClick={() => setShowVideo(false)} className="sp-btn sp-btn-primary sp-btn-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {showShot && screenshot && (
      <div
        onClick={() => setShowShot(false)}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%" }}>
          <img src={screenshot} alt="screenshot" style={{ width: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: 12, background: "#000" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setShowShot(false)} className="sp-btn sp-btn-primary sp-btn-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
