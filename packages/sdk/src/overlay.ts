/**
 * Shadow-DOM overlay: consent gate, element pick, structured fields, text
 * note, idempotent add + Send. Technical/breadcrumb/host-app context are
 * attached automatically. Screenshot/voice/recording, redaction and offline
 * drafts are later Phase 5 sub-steps (§14).
 */
import type { HostAppContext, NavigationStep, TechnicalContext } from "@speqify/shared";
import type { SpeqifyClient } from "./client.js";
import { buildAnnotationPayload, type ElementCapture, type StructuredInput } from "./payload.js";
import { captureElement } from "./selector.js";
import { getClientId, getSubmissionId, resetSubmission } from "./session.js";

const CONSENT_KEY = "speqify.consent";

const STYLE = `
:host{all:initial}
.fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;height:48px;padding:0 20px;border:0;
  border-radius:9999px;background:#0F172A;color:#fff;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}
.panel{position:fixed;right:16px;bottom:76px;z-index:2147483000;width:340px;background:#fff;color:#0F172A;
  border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.16);
  font:14px Inter,system-ui,sans-serif;padding:16px}
.panel h3{margin:0 0 8px;font-size:16px}.muted{color:#64748B;font-size:12px}
button.act{height:40px;padding:0 14px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;color:#0F172A;
  font:600 14px Inter,system-ui,sans-serif;cursor:pointer;margin:0 8px 8px 0}
button.primary{background:#0F172A;color:#fff;border-color:#0F172A}
textarea{width:100%;min-height:60px;margin:8px 0;padding:8px;border:1px solid #CBD5E1;border-radius:6px;font:inherit}
select{height:36px;border:1px solid #CBD5E1;border-radius:6px;margin:0 8px 8px 0;font:inherit}
.ok{color:#15803D}.err{color:#B91C1C}
.hl{outline:3px solid #1D4ED8 !important;outline-offset:2px !important}
`;

export interface OverlayDeps {
  technical?: () => TechnicalContext;
  breadcrumb?: () => NavigationStep[];
  hostApp?: HostAppContext;
}

export interface OverlayInstance {
  open(): void;
  close(): void;
  destroy(): void;
}

export function mountOverlay(client: SpeqifyClient, deps: OverlayDeps = {}): OverlayInstance {
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
  root.appendChild(panel);

  const consented = (): boolean => localStorage.getItem(CONSENT_KEY) === "1";

  const renderConsent = (): void => {
    panel.innerHTML = `
      <h3>Before you start</h3>
      <p class="muted">To turn your feedback into tickets, Speqify records what you
      mark, your notes, and technical context (console, network, errors, browser).
      Secrets are stripped in your browser before sending. Continue?</p>
      <button class="act primary" data-agree>I agree</button>
      <button class="act" data-decline>No thanks</button>`;
    panel.querySelector("[data-agree]")?.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "1");
      renderMain();
    });
    panel.querySelector("[data-decline]")?.addEventListener("click", () => {
      panel.hidden = true;
    });
  };

  const renderMain = (): void => {
    panel.innerHTML = `
      <h3>Speqify</h3>
      <p class="muted">Point at something, describe the change, send.</p>
      <button class="act" data-pick>Pick element</button>
      <p class="muted" data-sel>No element selected</p>
      <div>
        <select data-kind><option value="bug">Bug</option><option value="change">Change</option></select>
        <select data-sev><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select>
      </div>
      <textarea data-note placeholder="What should change here?"></textarea>
      <div>
        <button class="act primary" data-add>Add</button>
        <button class="act" data-send>Send (<span data-count>0</span>)</button>
      </div>
      <p data-msg></p>`;

    const q = <T extends Element>(s: string): T => panel.querySelector(s) as T;
    const sel = q<HTMLElement>("[data-sel]");
    const note = q<HTMLTextAreaElement>("[data-note]");
    const kind = q<HTMLSelectElement>("[data-kind]");
    const sev = q<HTMLSelectElement>("[data-sev]");
    const msg = q<HTMLElement>("[data-msg]");
    const counter = q<HTMLElement>("[data-count]");
    counter.textContent = String(count);

    const clearHl = (): void => pickedEl?.classList.remove("hl");
    const onPick = (e: Event): void => {
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
          const structured: StructuredInput = {
            kind: kind.value === "change" ? "change" : "bug",
            severity: sev.value === "low" ? "low" : sev.value === "high" ? "high" : "medium",
          };
          const body = buildAnnotationPayload({
            submissionId: getSubmissionId(),
            clientId: getClientId(),
            pageUrl: location.href,
            element: picked,
            textNote: note.value.trim() || null,
            structured,
            technical: deps.technical?.() ?? null,
            hostApp: deps.hostApp ?? null,
            breadcrumb: deps.breadcrumb?.() ?? [],
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
  };

  const api: OverlayInstance = {
    open: () => {
      panel.hidden = false;
      if (consented()) renderMain();
      else renderConsent();
    },
    close: () => {
      panel.hidden = true;
    },
    destroy: () => {
      pickedEl?.classList.remove("hl");
      host.remove();
    },
  };
  fab.addEventListener("click", () => (panel.hidden ? api.open() : api.close()));
  return api;
}
