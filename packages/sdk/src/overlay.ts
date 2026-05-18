/**
 * Shadow-DOM overlay (foundation): launcher, element pick, text note,
 * idempotent add + Send. Voice/recording/technical capture, redaction,
 * offline drafts and consent are later Phase 5 sub-steps (§14).
 */
import type { SpeqifyClient } from "./client.js";
import { buildAnnotationPayload, type ElementCapture } from "./payload.js";
import { captureElement } from "./selector.js";
import { getClientId, getSubmissionId, resetSubmission } from "./session.js";

const STYLE = `
:host{all:initial}
.fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;height:48px;padding:0 20px;
  border:0;border-radius:9999px;background:#0F172A;color:#fff;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}
.panel{position:fixed;right:16px;bottom:76px;z-index:2147483000;width:320px;background:#fff;
  color:#0F172A;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.16);
  font:14px Inter,system-ui,sans-serif;padding:16px}
.panel h3{margin:0 0 8px;font-size:16px}
.muted{color:#64748B;font-size:12px}
button.act{height:40px;padding:0 14px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;
  color:#0F172A;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;margin-right:8px}
button.primary{background:#0F172A;color:#fff;border-color:#0F172A}
textarea{width:100%;min-height:64px;margin:8px 0;padding:8px;border:1px solid #CBD5E1;border-radius:6px;font:inherit}
.ok{color:#15803D}.err{color:#B91C1C}
.hl{outline:3px solid #1D4ED8 !important;outline-offset:2px !important}
`;

export interface OverlayInstance {
  open(): void;
  close(): void;
  destroy(): void;
}

export function mountOverlay(client: SpeqifyClient): OverlayInstance {
  const host = document.createElement("div");
  host.setAttribute("data-speqify-overlay", "");
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  root.appendChild(style);

  let picked: ElementCapture | null = null;
  let pickedEl: Element | null = null;
  let count = 0;

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.textContent = "Feedback";
  root.appendChild(fab);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.hidden = true;
  panel.innerHTML = `
    <h3>Speqify</h3>
    <p class="muted">Point at something, add a note, send.</p>
    <button class="act" data-pick>Pick element</button>
    <p class="muted" data-sel>No element selected</p>
    <textarea data-note placeholder="What should change here?"></textarea>
    <div>
      <button class="act primary" data-add>Add</button>
      <button class="act" data-send>Send (<span data-count>0</span>)</button>
    </div>
    <p data-msg></p>`;
  root.appendChild(panel);

  const $ = <T extends Element>(s: string) => panel.querySelector(s) as T;
  const sel = $("[data-sel]") as HTMLElement;
  const note = $("[data-note]") as HTMLTextAreaElement;
  const msg = $("[data-msg]") as HTMLElement;
  const counter = $("[data-count]") as HTMLElement;

  const clearHl = () => {
    if (pickedEl) pickedEl.classList.remove("hl");
  };

  const onPick = (e: Event) => {
    if (e.composedPath().includes(host)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const target = e.target as Element | null;
    if (!target) return;
    clearHl();
    pickedEl = target;
    target.classList.add("hl");
    picked = captureElement(target);
    sel.textContent = picked.selector;
    document.removeEventListener("click", onPick, true);
  };

  panel.querySelector("[data-pick]")?.addEventListener("click", () => {
    msg.textContent = "Click any element on the page…";
    document.addEventListener("click", onPick, true);
  });

  panel.querySelector("[data-add]")?.addEventListener("click", () => {
    void (async () => {
      try {
        const body = buildAnnotationPayload({
          submissionId: getSubmissionId(),
          clientId: getClientId(),
          pageUrl: location.href,
          element: picked,
          textNote: note.value.trim() || null,
        });
        await client.createAnnotation(body);
        count++;
        counter.textContent = String(count);
        note.value = "";
        picked = null;
        clearHl();
        sel.textContent = "No element selected";
        msg.className = "ok";
        msg.textContent = "Added.";
      } catch (err) {
        msg.className = "err";
        msg.textContent = err instanceof Error ? err.message : "Failed";
      }
    })();
  });

  panel.querySelector("[data-send]")?.addEventListener("click", () => {
    void (async () => {
      try {
        await client.submit(getSubmissionId(), getClientId());
        resetSubmission();
        count = 0;
        counter.textContent = "0";
        msg.className = "ok";
        msg.textContent = "Sent. Thank you!";
      } catch (err) {
        msg.className = "err";
        msg.textContent = err instanceof Error ? err.message : "Failed";
      }
    })();
  });

  const api: OverlayInstance = {
    open: () => {
      panel.hidden = false;
    },
    close: () => {
      panel.hidden = true;
    },
    destroy: () => {
      clearHl();
      document.removeEventListener("click", onPick, true);
      host.remove();
    },
  };
  fab.addEventListener("click", () => (panel.hidden ? api.open() : api.close()));
  return api;
}
