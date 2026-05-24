import { defineBackground, browser } from "#imports";
import type { BackgroundRequest, ScreenshotResponse } from "@/messaging";

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel.
  browser.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.warn("[speqify] setPanelBehavior failed", err));

  browser.runtime.onMessage.addListener(
    (msg: BackgroundRequest, _sender, sendResponse: (r: ScreenshotResponse) => void) => {
      if (msg?.type === "SPEQIFY_SCREENSHOT") {
        browser.tabs
          .captureVisibleTab(msg.windowId, { format: "jpeg", quality: 70 })
          .then((dataUrl) => sendResponse({ dataUrl }))
          .catch((err: unknown) => sendResponse({ error: String(err) }));
        return true; // async response
      }
      return false;
    },
  );
});
