import { Icons } from "@speqify/ui";
import type { CaptureDefaults } from "@/store";
import type { CropRegion } from "./recorder";

/**
 * Shown after the user has selected an area/element but before screen-share.
 * The picker (a page overlay) consumes the original click's user activation, so
 * we need a fresh click here to launch getDisplayMedia.
 */
export function ArmedConfirm({
  crop,
  source,
  onStart,
  onReselect,
  onCancel,
}: {
  crop: CropRegion | null;
  source: CaptureDefaults["source"];
  onStart: () => void;
  onReselect: () => void;
  onCancel: () => void;
}) {
  const dim = crop ? `${Math.round(crop.rect.w)} × ${Math.round(crop.rect.h)} px` : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, padding: 29, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 17, textAlign: "center" }}>
        <div style={{ width: 67, height: 67, borderRadius: 17, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {source === "element" ? <Icons.Crosshair size={31} /> : <Icons.Crop size={31} />}
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 650 }}>{source === "element" ? "Element selected" : "Area selected"}</div>
          <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 5, maxWidth: 336 }}>
            {dim ? `${dim} · ` : ""}the recording will be cropped to it.
          </div>
        </div>
        <div style={{ fontSize: 14, color: "var(--sp-indigo-700)", background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.45 }}>
          On <b>Start recording</b>, choose <b>This tab</b> in the share prompt so the crop lines up.
        </div>
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onStart} className="sp-btn sp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 1199, background: "#fff" }} /> Start recording
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} className="sp-btn sp-btn-ghost sp-btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            Cancel
          </button>
          <button onClick={onReselect} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            <Icons.Crop size={14} /> Reselect
          </button>
        </div>
      </div>
    </div>
  );
}
