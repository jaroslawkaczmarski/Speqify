import { browser } from "#imports";
import { emptyContext, type CaptureContext } from "@speqify/core";
import type {
  AreaResponse,
  BackgroundRequest,
  ContentRequest,
  ContextResponse,
  LiveClickMessage,
  PickResponse,
  ScreenshotResponse,
} from "./messaging";

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

/** Collect console/network/error/step context from the active tab's content script. */
export async function getContext(): Promise<CaptureContext> {
  const tab = await activeTab();
  const fallback = emptyContext({
    url: tab?.url ?? "",
    title: tab?.title ?? "",
    userAgent: navigator.userAgent,
    viewport: { w: 0, h: 0, dpr: 1 },
  });
  if (!tab?.id) return fallback;
  try {
    const res = (await browser.tabs.sendMessage(tab.id, {
      type: "SPEQIFY_GET_CONTEXT",
    } satisfies ContentRequest)) as ContextResponse;
    return {
      page: res.page,
      console: res.console,
      network: res.network,
      errors: res.errors,
      steps: res.steps ?? [],
    };
  } catch {
    return fallback; // no content script (chrome://, web store, etc.)
  }
}

/** Tell the active tab to begin/stop a capture (resets step buffer, streams live clicks). */
export async function startCapture(trackSteps: boolean): Promise<void> {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type: "SPEQIFY_START_CAPTURE", trackSteps } satisfies ContentRequest);
  } catch {
    /* no content script on this page */
  }
}

export async function endCapture(): Promise<void> {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type: "SPEQIFY_END_CAPTURE" } satisfies ContentRequest);
  } catch {
    /* ignore */
  }
}

/** Subscribe to live click coordinates streamed during a capture. Returns an unsubscribe fn. */
export function onLiveClick(cb: (m: LiveClickMessage) => void): () => void {
  const listener = (msg: unknown) => {
    if ((msg as LiveClickMessage)?.type === "SPEQIFY_LIVE_CLICK") cb(msg as LiveClickMessage);
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

/** Ask the user to click an element on the page; returns its info + the viewport it was measured in. */
export async function pickElement(): Promise<PickResponse | null> {
  const tab = await activeTab();
  if (!tab?.id) return null;
  try {
    return (await browser.tabs.sendMessage(tab.id, {
      type: "SPEQIFY_PICK_ELEMENT",
    } satisfies ContentRequest)) as PickResponse;
  } catch {
    return null;
  }
}

/** Ask the user to drag a region on the page; returns the rect + the viewport it was measured in. */
export async function pickArea(): Promise<AreaResponse | null> {
  const tab = await activeTab();
  if (!tab?.id) return null;
  try {
    return (await browser.tabs.sendMessage(tab.id, {
      type: "SPEQIFY_PICK_AREA",
    } satisfies ContentRequest)) as AreaResponse;
  } catch {
    return null;
  }
}

/** Capture a screenshot of the active tab via the background worker. */
export async function captureScreenshot(): Promise<string | null> {
  const win = await browser.windows.getCurrent();
  if (win.id == null) return null;
  const res = (await browser.runtime.sendMessage({
    type: "SPEQIFY_SCREENSHOT",
    windowId: win.id,
  } satisfies BackgroundRequest)) as ScreenshotResponse;
  return "dataUrl" in res ? res.dataUrl : null;
}
