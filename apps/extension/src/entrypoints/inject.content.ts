import { defineContentScript } from "#imports";
import { CAPTURE_SOURCE, type CaptureMessage } from "@/messaging";
import type { ConsoleLevel } from "@speqify/core";

/**
 * Runs in the page's MAIN world so it can observe the page's own console,
 * errors, and network activity (an isolated content script cannot). It only
 * relays data out via window.postMessage — never touches chrome.* APIs.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    install();
  },
});

function install() {
  const post = (msg: CaptureMessage) => {
    try {
      // Pin to our own origin so co-resident page/extension scripts can't eavesdrop.
      window.postMessage(msg, window.location.origin);
    } catch {
      /* ignore serialization failures */
    }
  };

  const fmt = (args: unknown[]): string =>
    args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ")
      .slice(0, 1000);

  const hookConsole = (level: ConsoleLevel) => {
    const orig = console[level] as (...args: unknown[]) => void;
    if (typeof orig !== "function") return;
    console[level] = (...args: unknown[]) => {
      post({ source: CAPTURE_SOURCE, kind: "console", entry: { level, message: fmt(args), at: Date.now() } });
      orig.apply(console, args);
    };
  };
  hookConsole("error");
  hookConsole("warn");

  window.addEventListener(
    "error",
    (e: ErrorEvent) => {
      post({
        source: CAPTURE_SOURCE,
        kind: "error",
        entry: {
          message: e.message || String(e.error ?? "Unknown error"),
          stack: e.error instanceof Error ? e.error.stack : undefined,
          at: Date.now(),
        },
      });
    },
    true,
  );

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    post({
      source: CAPTURE_SOURCE,
      kind: "error",
      entry: {
        message: reason instanceof Error ? `${reason.name}: ${reason.message}` : `Unhandled rejection: ${String(reason)}`,
        stack: reason instanceof Error ? reason.stack : undefined,
        at: Date.now(),
      },
    });
  });

  const recordNet = (method: string, url: string, status: number) => {
    // Drop the query string/fragment before buffering — they often carry tokens.
    const safeUrl = url.replace(/[?#].*$/, "").slice(0, 500);
    post({
      source: CAPTURE_SOURCE,
      kind: "network",
      entry: { method: method.toUpperCase(), url: safeUrl, status, ok: status >= 200 && status < 400, at: Date.now() },
    });
  };

  // fetch — record only failures to keep the buffer signal-rich.
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const url = input instanceof Request ? input.url : String(input);
      try {
        const res = await origFetch(input as RequestInfo, init);
        if (!res.ok) recordNet(method, url, res.status);
        return res;
      } catch (err) {
        recordNet(method, url, 0);
        throw err;
      }
    };
  }

  // XHR
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
      (this as XMLHttpRequest & { __speqify?: { method: string; url: string } }).__speqify = {
        method: String(method),
        url: String(url),
      };
      // eslint-disable-next-line prefer-rest-params
      return open.apply(this, arguments as unknown as Parameters<typeof open>);
    };
    XHR.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
      const meta = (this as XMLHttpRequest & { __speqify?: { method: string; url: string } }).__speqify;
      this.addEventListener("loadend", () => {
        if (meta && this.status >= 400) recordNet(meta.method, meta.url, this.status);
        if (meta && this.status === 0) recordNet(meta.method, meta.url, 0);
      });
      return send.apply(this, args as unknown as Parameters<typeof send>);
    };
  }
}
