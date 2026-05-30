import type {
  ConsoleEntry,
  ElementInfo,
  JsErrorEntry,
  NetworkEntry,
  PageInfo,
  ReproStep,
} from "@speqify/core";

/** postMessage envelope from the MAIN-world hook to the isolated bridge. */
export const CAPTURE_SOURCE = "speqify-capture-v1";

export type CaptureMessage =
  | { source: typeof CAPTURE_SOURCE; kind: "console"; entry: ConsoleEntry }
  | { source: typeof CAPTURE_SOURCE; kind: "network"; entry: NetworkEntry }
  | { source: typeof CAPTURE_SOURCE; kind: "error"; entry: JsErrorEntry };

/** A region of the viewport, in CSS pixels (returned by the area picker). */
export interface AreaRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Messages sent from the side panel to a tab's content script. */
export type ContentRequest =
  | { type: "SPEQIFY_GET_CONTEXT" }
  | { type: "SPEQIFY_PICK_ELEMENT" }
  | { type: "SPEQIFY_PICK_AREA" }
  /** Begin a capture: clears the step buffer and starts streaming live clicks. */
  | { type: "SPEQIFY_START_CAPTURE"; trackSteps: boolean }
  | { type: "SPEQIFY_END_CAPTURE" };

export interface ContextResponse {
  page: PageInfo;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  errors: JsErrorEntry[];
  steps: ReproStep[];
}

export interface PickResponse {
  element: ElementInfo | null;
  /** The viewport the element rect was measured against (for scaling onto the capture). */
  viewport: { w: number; h: number };
}

export interface AreaResponse {
  rect: AreaRect | null;
  /** The viewport the rect was measured against (for scaling onto the capture). */
  viewport: { w: number; h: number };
}

/**
 * Live click broadcast from a tab's content script to the panel during a
 * capture — used to paint cursor-highlight rings into the canvas recording.
 * Coordinates are CSS px relative to the captured tab's viewport.
 */
export interface LiveClickMessage {
  type: "SPEQIFY_LIVE_CLICK";
  x: number;
  y: number;
  viewport: { w: number; h: number };
}

/** Messages sent from the side panel to the background service worker. */
export type BackgroundRequest = { type: "SPEQIFY_SCREENSHOT"; windowId: number };

export type ScreenshotResponse = { dataUrl: string } | { error: string };
