/**
 * @speqify/sdk — overlay SDK.
 *
 * Done: token validation, consent gate, element pick, structured fields,
 * text note, automatic technical + breadcrumb + host-app context, idempotent
 * add + Send. Later Phase 5 sub-steps (§14): screenshot, voice, screen
 * recording, redaction tool, offline drafts.
 */
import type { HostAppContext } from "@speqify/shared";
import { startBreadcrumb } from "./breadcrumb.js";
import { SpeqifyClient } from "./client.js";
import { mountOverlay, type OverlayInstance } from "./overlay.js";
import { startTechnicalCapture } from "./technical.js";

export interface SpeqifyInitOptions {
  /** Panel capability token (from URL/launcher). SDK stays dormant if invalid. */
  token: string;
  /** API base, e.g. https://api.speqify.app */
  apiBaseUrl: string;
  /** Only activate in non-production / review environments. */
  enabled: boolean;
  /** Host-app context bundled with every annotation (build/env/user/flags). */
  context?: HostAppContext;
  /** Override the html2canvas CDN URL (defaults to a pinned jsDelivr build). */
  html2canvasUrl?: string;
}

export type SpeqifyInstance = OverlayInstance;

export async function init(options: SpeqifyInitOptions): Promise<SpeqifyInstance | null> {
  if (!options.enabled || !options.token) return null;
  const client = new SpeqifyClient(options.apiBaseUrl, options.token);
  const info = await client.validate();
  if (!info || info.status !== "open") return null;

  const technical = startTechnicalCapture();
  const breadcrumb = startBreadcrumb();
  const overlay = mountOverlay(client, {
    technical: technical.snapshot,
    breadcrumb: breadcrumb.steps,
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
    },
  };
}

export const SDK_VERSION = "0.2.0";
export { SpeqifyClient } from "./client.js";
export { buildAnnotationPayload } from "./payload.js";
