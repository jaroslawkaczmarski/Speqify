/**
 * Shadow-DOM overlay: consent gate, element pick, structured fields, text
 * note, idempotent add + Send. Technical/breadcrumb/host-app context are
 * attached automatically. Screenshot/voice/recording, redaction and offline
 * drafts are later Phase 5 sub-steps (§14).
 */
import type {
  CreateAnnotationInput,
  HostAppContext,
  NavigationStep,
  TechnicalContext,
} from "@speqify/shared";
import type { SpeqifyClient } from "./client.js";
import {
  startScreenRecording,
  startVoiceRecording,
  type ScreenRecorder,
  type ScreenRecording,
  type VoiceRecorder,
} from "./media.js";
import { buildAnnotationPayload, type ElementCapture, type StructuredInput } from "./payload.js";
import { redactBlob, type Rect } from "./redact.js";
import { captureScreenshot } from "./screenshot.js";
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
  screenshotUrl?: string;
  /** Offline-resilient send (outbox). Falls back to direct create if absent. */
  sendAnnotation?: (payload: CreateAnnotationInput) => Promise<"sent" | "queued">;
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
  let voiceBlob: Blob | null = null;
  let recorder: VoiceRecorder | null = null;
  let screenRec: ScreenRecorder | null = null;
  let screenOut: ScreenRecording | null = null;
  let redactedShot: Blob | null = null;

  /** Modal canvas: drag black boxes over a screenshot before it's uploaded. */
  const openRedactor = (source: Blob): void => {
    void (async () => {
      const bitmap = await createImageBitmap(source);
      const maxW = 300;
      const ratio = bitmap.width > maxW ? maxW / bitmap.width : 1;
      const dw = Math.round(bitmap.width * ratio);
      const dh = Math.round(bitmap.height * ratio);

      const layer = document.createElement("div");
      layer.style.cssText =
        "position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.6);" +
        "display:flex;align-items:center;justify-content:center";
      const box = document.createElement("div");
      box.style.cssText =
        "background:#fff;border-radius:12px;padding:16px;font:14px Inter,system-ui,sans-serif";
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      canvas.style.cssText = "cursor:crosshair;display:block;touch-action:none";
      const bar = document.createElement("div");
      bar.style.cssText = "margin-top:12px;display:flex;gap:8px";
      bar.innerHTML =
        '<button class="act primary" data-ap>Apply</button>' +
        '<button class="act" data-ca>Cancel</button>' +
        '<span class="muted" style="align-self:center">Drag to hide sensitive areas</span>';
      box.appendChild(canvas);
      box.appendChild(bar);
      layer.appendChild(box);
      root.appendChild(layer);

      const ctx = canvas.getContext("2d");
      const rects: Rect[] = [];
      let start: { x: number; y: number } | null = null;
      let cur: Rect | null = null;
      const draw = (): void => {
        if (!ctx) return;
        ctx.drawImage(bitmap, 0, 0, dw, dh);
        ctx.fillStyle = "rgba(0,0,0,.85)";
        for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
        if (cur) ctx.fillRect(cur.x, cur.y, cur.w, cur.h);
      };
      draw();
      const norm = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y),
      });
      canvas.addEventListener("pointerdown", (e) => {
        start = { x: e.offsetX, y: e.offsetY };
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!start) return;
        cur = norm(start, { x: e.offsetX, y: e.offsetY });
        draw();
      });
      canvas.addEventListener("pointerup", () => {
        if (cur && cur.w > 2 && cur.h > 2) rects.push(cur);
        start = null;
        cur = null;
        draw();
      });

      bar.querySelector("[data-ca]")?.addEventListener("click", () => {
        bitmap.close();
        layer.remove();
      });
      bar.querySelector("[data-ap]")?.addEventListener("click", () => {
        void (async () => {
          const natural = rects.map((r) => ({
            x: r.x / ratio,
            y: r.y / ratio,
            w: r.w / ratio,
            h: r.h / ratio,
          }));
          redactedShot = await redactBlob(source, natural);
          bitmap.close();
          layer.remove();
        })();
      });
    })();
  };

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
      <label class="muted" style="display:block;margin:8px 0">
        <input type="checkbox" data-shot checked /> Attach screenshot of selection
      </label>
      <button class="act" data-redact>Redact screenshot…</button>
      <div>
        <button class="act" data-rec>Record voice</button>
        <button class="act" data-screen>Record screen</button>
        <span class="muted" data-vstat></span>
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
    const vstat = q<HTMLElement>("[data-vstat]");
    const recBtn = q<HTMLButtonElement>("[data-rec]");
    const screenBtn = q<HTMLButtonElement>("[data-screen]");
    const shot = q<HTMLInputElement>("[data-shot]");
    const redactBtn = q<HTMLButtonElement>("[data-redact]");
    counter.textContent = String(count);

    redactBtn.addEventListener("click", () => {
      void (async () => {
        try {
          const base = await captureScreenshot(pickedEl, deps.screenshotUrl);
          openRedactor(base);
        } catch {
          vstat.textContent = "screenshot failed";
        }
      })();
    });
    if (voiceBlob) vstat.textContent = "voice attached";
    if (screenOut) vstat.textContent = "recording attached";

    screenBtn.addEventListener("click", () => {
      void (async () => {
        if (screenRec) {
          screenOut = await screenRec.stop();
          screenRec = null;
          screenBtn.textContent = "Record screen";
          vstat.textContent = "recording attached";
        } else {
          try {
            screenRec = await startScreenRecording();
            screenBtn.textContent = "Stop screen ●";
            vstat.textContent = "recording screen…";
          } catch {
            vstat.textContent = "screen capture blocked";
          }
        }
      })();
    });

    recBtn.addEventListener("click", () => {
      void (async () => {
        if (recorder) {
          voiceBlob = await recorder.stop();
          recorder = null;
          recBtn.textContent = "Record voice";
          vstat.textContent = "voice attached";
        } else {
          try {
            recorder = await startVoiceRecording();
            recBtn.textContent = "Stop ●";
            vstat.textContent = "recording…";
          } catch {
            vstat.textContent = "mic blocked";
          }
        }
      })();
    });

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
          const voice = voiceBlob ? await client.upload("voice", voiceBlob) : null;
          let screenshot = null;
          if (redactedShot) {
            screenshot = await client.upload("screenshot", redactedShot);
          } else if (shot.checked) {
            try {
              const blob = await captureScreenshot(pickedEl, deps.screenshotUrl);
              screenshot = await client.upload("screenshot", blob);
            } catch {
              /* non-fatal: send the annotation without a screenshot */
            }
          }
          let recordingVideo = null;
          let recordingAudio = null;
          if (screenOut) {
            recordingVideo = await client.upload("recording-video", screenOut.video);
            if (screenOut.audio) {
              recordingAudio = await client.upload("recording-audio", screenOut.audio);
            }
          }
          const body = buildAnnotationPayload({
            submissionId: getSubmissionId(),
            clientId: getClientId(),
            pageUrl: location.href,
            element: picked,
            textNote: note.value.trim() || null,
            screenshot,
            voice,
            recordingVideo,
            recordingAudio,
            structured,
            technical: deps.technical?.() ?? null,
            hostApp: deps.hostApp ?? null,
            breadcrumb: deps.breadcrumb?.() ?? [],
          });
          let outcome: "sent" | "queued" = "sent";
          if (deps.sendAnnotation) {
            outcome = await deps.sendAnnotation(body);
          } else {
            await client.createAnnotation(body);
          }
          count++;
          counter.textContent = String(count);
          note.value = "";
          picked = null;
          voiceBlob = null;
          screenOut = null;
          redactedShot = null;
          screenBtn.textContent = "Record screen";
          vstat.textContent = "";
          clearHl();
          sel.textContent = "No element selected";
          msg.className = "ok";
          msg.textContent = outcome === "queued" ? "Saved offline — will retry." : "Added.";
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
