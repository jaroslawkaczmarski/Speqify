/**
 * @speqify/sdk — overlay SDK (loader + overlay UI).
 *
 * SKELETON ONLY (Phase 5). This file pins the public init contract so host apps
 * can integrate against a stable surface while the implementation is built out
 * (see IMPLEMENTATION_PLAN.md §6 Phase 5 and §7 distribution).
 */
import type { HostAppContext } from "@speqify/shared";

export interface SpeqifyInitOptions {
  /** Panel capability token (from URL/launcher). SDK stays dormant if invalid. */
  token: string;
  /** API base, e.g. https://api.speqify.app */
  apiBaseUrl: string;
  /** Only activate in non-production / review environments. */
  enabled: boolean;
  /** Host-app context bundled with every annotation (build/env/user/flags). */
  context?: HostAppContext;
}

export interface SpeqifyInstance {
  open(): void;
  close(): void;
  destroy(): void;
}

export function init(_options: SpeqifyInitOptions): SpeqifyInstance {
  throw new Error("Not implemented yet — Phase 5 (IMPLEMENTATION_PLAN.md §6).");
}

export const SDK_VERSION = "0.0.0";
