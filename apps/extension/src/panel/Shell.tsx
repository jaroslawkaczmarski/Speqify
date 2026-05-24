import type { CSSProperties, ReactNode } from "react";
import { Icons, SpeqifyWordmark } from "@speqify/ui";

const iconBtnS: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--sp-text-2)",
};

export type PanelView = "home" | "drafts";

export function Shell({
  view,
  draftsCount = 0,
  onHome,
  onDrafts,
  onSettings,
  onClose,
  children,
}: {
  view: PanelView;
  draftsCount?: number;
  onHome: () => void;
  onDrafts: () => void;
  onSettings: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="sp"
      style={{
        width: "100%",
        height: "100%",
        background: "var(--sp-bg)",
        display: "flex",
        flexDirection: "column",
        color: "var(--sp-text)",
        position: "relative",
      }}
    >
      {/* Header — logo doubles as Home link */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "12px 14px",
          borderBottom: "1px solid var(--sp-border)",
          background: "var(--sp-surface)",
        }}
      >
        <button
          onClick={onHome}
          title="Home"
          style={{ display: "flex", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4 }}
        >
          <SpeqifyWordmark height={18} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onDrafts}
          title="Drafts"
          style={{
            ...iconBtnS,
            position: "relative",
            background: view === "drafts" ? "var(--sp-indigo-50)" : "transparent",
            color: view === "drafts" ? "var(--sp-indigo-700)" : "var(--sp-text-2)",
          }}
        >
          <Icons.Edit size={14} />
          {draftsCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 1,
                background: "var(--sp-indigo-600)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1,
                padding: "2px 4px",
                minWidth: 13,
                height: 13,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid var(--sp-surface)",
              }}
            >
              {draftsCount}
            </span>
          )}
        </button>
        <button
          onClick={onSettings}
          title="Settings"
          style={{ ...iconBtnS, color: "var(--sp-text-2)" }}
        >
          <Icons.Cog size={14} />
        </button>
        <button onClick={onClose} title="Close panel" style={iconBtnS}>
          <Icons.X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
