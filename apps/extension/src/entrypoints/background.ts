import { defineBackground, browser } from "#imports";
import type { BackgroundRequest, ScreenshotResponse } from "@/messaging";

export default defineBackground(() => {
  if (import.meta.env.FIREFOX) {
    // Firefox has no sidePanel API; open our sidebar when the toolbar icon is clicked
    // (Alt+S maps to the built-in _execute_sidebar_action command in the manifest).
    // WxtBrowser is Chrome-typed, so reach the Firefox-only sidebarAction via a cast.
    const sidebarAction = (browser as unknown as { sidebarAction?: { toggle(): Promise<void> } })
      .sidebarAction;
    browser.action.onClicked.addListener(() => {
      void sidebarAction?.toggle().catch((err: unknown) =>
        console.warn("[speqify] sidebar toggle failed", err),
      );
    });
  } else {
    // Chromium: clicking the toolbar icon opens the side panel.
    browser.sidePanel
      ?.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err: unknown) => console.warn("[speqify] setPanelBehavior failed", err));
  }

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
