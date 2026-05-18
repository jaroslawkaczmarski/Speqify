/**
 * @speqify/sdk — overlay SDK (Phase 5 foundation).
 *
 * Implemented: token validation, element pick, text note, idempotent
 * add + Send. NOT yet (later Phase 5 sub-steps, §14): screenshot, voice,
 * screen recording, technical-context capture, redaction, offline drafts,
 * consent notice, host-app context injection.
 */
import type { HostAppContext } from "@speqify/shared";
import { SpeqifyClient } from "./client.js";
import { mountOverlay, type OverlayInstance } from "./overlay.js";

export interface SpeqifyInitOptions {
  /** Panel capability token (from URL/launcher). SDK stays dormant if invalid. */
  token: string;
  /** API base, e.g. https://api.speqify.app */
  apiBaseUrl: string;
  /** Only activate in non-production / review environments. */
  enabled: boolean;
  /** Reserved — host-app context injection lands in a later Phase 5 sub-step. */
  context?: HostAppContext;
}

export type SpeqifyInstance = OverlayInstance;

export async function init(options: SpeqifyInitOptions): Promise<SpeqifyInstance | null> {
  if (!options.enabled || !options.token) return null;
  const client = new SpeqifyClient(options.apiBaseUrl, options.token);
  const info = await client.validate();
  if (!info || info.status !== "open") return null;
  return mountOverlay(client);
}

export const SDK_VERSION = "0.1.0";
export { SpeqifyClient } from "./client.js";
export { buildAnnotationPayload } from "./payload.js";
