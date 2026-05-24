import { browser } from "#imports";
import { emptyContext, type CaptureContext, type ElementInfo } from "@speqify/core";
import type {
  BackgroundRequest,
  ContentRequest,
  ContextResponse,
  PickResponse,
  ScreenshotResponse,
} from "./messaging";

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

/** Collect console/network/error context from the active tab's content script. */
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
    return { page: res.page, console: res.console, network: res.network, errors: res.errors };
  } catch {
    return fallback; // no content script (chrome://, web store, etc.)
  }
}

/** Ask the user to click an element on the page; returns its selector + html. */
export async function pickElement(): Promise<ElementInfo | null> {
  const tab = await activeTab();
  if (!tab?.id) return null;
  try {
    const res = (await browser.tabs.sendMessage(tab.id, {
      type: "SPEQIFY_PICK_ELEMENT",
    } satisfies ContentRequest)) as PickResponse;
    return res.element;
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
