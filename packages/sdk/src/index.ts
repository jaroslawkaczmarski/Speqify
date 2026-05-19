/**
 * @speqify/sdk — overlay SDK.
 *
 * Dark-by-default install: the script can ship on production but only opens
 * the overlay when a URL carries the session+reviewer token pair. All capture
 * (token validation, consent gate, element pick, structured fields, text
 * note, voice, screenshot + redaction, narrated screen recording, automatic
 * technical + breadcrumb + host-app context, idempotent add + Send,
 * offline-resilient outbox) is unchanged from Phase 5.
 */
import type { HostAppContext } from "@speqify/shared";
import { startBreadcrumb } from "./breadcrumb.js";
import { SpeqifyClient } from "./client.js";
import { createOutboxStore } from "./idb.js";
import { Outbox, type SendFn } from "./outbox.js";
import { mountOverlay, type OverlayInstance } from "./overlay.js";
import { startTechnicalCapture } from "./technical.js";

export interface SpeqifyInitOptions {
  /** Session token (from `?speqify_session=`). */
  sessionToken: string;
  /** Reviewer token (from `?speqify_reviewer=`). */
  reviewerToken: string;
  /** API base, e.g. https://api.speqify.app */
  apiBaseUrl: string;
  /** Master kill-switch. Leaves the script dormant even if URL tokens exist. */
  enabled: boolean;
  /** Host-app context bundled with every annotation (build/env/user/flags). */
  context?: HostAppContext;
  /** Override the html2canvas CDN URL (defaults to a pinned jsDelivr build). */
  html2canvasUrl?: string;
}

export type SpeqifyInstance = OverlayInstance;

const FLUSH_INTERVAL_MS = 30_000;

export async function init(options: SpeqifyInitOptions): Promise<SpeqifyInstance | null> {
  if (!options.enabled || !options.sessionToken || !options.reviewerToken) return null;
  const client = new SpeqifyClient(options.apiBaseUrl, {
    sessionToken: options.sessionToken,
    reviewerToken: options.reviewerToken,
  });
  const intro = await client.fetchIntro();
  if (!intro) return null;

  const technical = startTechnicalCapture();
  const breadcrumb = startBreadcrumb();

  // Offline-resilient send: try now, persist + retry on failure (§14). The
  // outbox holds payloads only — the bearer tokens live on the client closure
  // so we never persist secrets to IndexedDB.
  const outbox = new Outbox(createOutboxStore());
  const sender: SendFn = (p) => client.createAnnotation(p);
  const flush = (): void => void outbox.flush(sender).catch(() => undefined);
  flush();
  const onOnline = (): void => flush();
  window.addEventListener("online", onOnline);
  const timer = window.setInterval(flush, FLUSH_INTERVAL_MS);

  const overlay = mountOverlay(client, {
    technical: technical.snapshot,
    breadcrumb: breadcrumb.steps,
    sendAnnotation: (p) => outbox.send(p, sender),
    sessionLabel: intro.sessionName || intro.projectName || "",
    intro,
    ...(options.context ? { hostApp: options.context } : {}),
    ...(options.html2canvasUrl ? { screenshotUrl: options.html2canvasUrl } : {}),
  });

  return {
    open: overlay.open,
    close: overlay.close,
    destroy: () => {
      overlay.destroy();
      technical.stop();
      breadcrumb.stop();
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    },
  };
}

export const SDK_VERSION = "0.6.0";
export { SpeqifyClient } from "./client.js";
export { buildAnnotationPayload } from "./payload.js";
