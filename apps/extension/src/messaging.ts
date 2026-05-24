import type {
  ConsoleEntry,
  ElementInfo,
  JsErrorEntry,
  NetworkEntry,
  PageInfo,
} from "@speqify/core";

/** postMessage envelope from the MAIN-world hook to the isolated bridge. */
export const CAPTURE_SOURCE = "speqify-capture-v1";

export type CaptureMessage =
  | { source: typeof CAPTURE_SOURCE; kind: "console"; entry: ConsoleEntry }
  | { source: typeof CAPTURE_SOURCE; kind: "network"; entry: NetworkEntry }
  | { source: typeof CAPTURE_SOURCE; kind: "error"; entry: JsErrorEntry };

/** Messages sent from the side panel to a tab's content script. */
export type ContentRequest =
  | { type: "SPEQIFY_GET_CONTEXT" }
  | { type: "SPEQIFY_PICK_ELEMENT" }
  | { type: "SPEQIFY_CANCEL_PICK" };

export interface ContextResponse {
  page: PageInfo;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  errors: JsErrorEntry[];
}

export interface PickResponse {
  element: ElementInfo | null;
}

/** Messages sent from the side panel to the background service worker. */
export type BackgroundRequest = { type: "SPEQIFY_SCREENSHOT"; windowId: number };

export type ScreenshotResponse = { dataUrl: string } | { error: string };
