import type { ReactNode } from "react";

export type PanelView = "home" | "drafts";

/**
 * Panel container. The browser's side-panel chrome already shows the Speqify
 * name + icon, so we don't render our own top header — per-view navigation
 * (Drafts / Settings) lives inside each view instead.
 */
export function Shell({ children }: { children: ReactNode }) {
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
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
