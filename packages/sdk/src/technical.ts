/**
 * Technical-envelope capture (the Usersnap insight, §13): console, JS errors
 * and network — the context that makes a ticket dev-ready. Patches are safe:
 * originals are called through and restored on stop; failures never break the
 * host app. XHR is intentionally out of scope for the foundation (fetch only).
 */
import type { TechnicalContext } from "@speqify/shared";
import { capArray, capString, scrubString, scrubUrl } from "./scrub.js";

type LogFn = (...args: unknown[]) => void;
type ConsoleLike = Record<"log" | "warn" | "error", LogFn>;

const CAP = { console: 200, errors: 100, network: 200, msg: 4000, stack: 8000 };

export interface TechnicalCapture {
  snapshot(): TechnicalContext;
  stop(): void;
}

function safe(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function startTechnicalCapture(): TechnicalCapture {
  const consoleEntries: TechnicalContext["consoleEntries"] = [];
  const jsErrors: TechnicalContext["jsErrors"] = [];
  const network: TechnicalContext["network"] = [];
  const now = (): string => new Date().toISOString();

  const con = console as unknown as ConsoleLike;
  const original: ConsoleLike = { log: con.log, warn: con.warn, error: con.error };
  (["log", "warn", "error"] as const).forEach((level) => {
    con[level] = (...args: unknown[]) => {
      try {
        consoleEntries.push({
          level,
          message: capString(scrubString(args.map(safe).join(" ")), CAP.msg),
          at: now(),
        });
      } catch {
        /* never break the host */
      }
      original[level](...args);
    };
  });

  const onError = (e: ErrorEvent): void => {
    const stack = e.error instanceof Error ? e.error.stack : undefined;
    jsErrors.push({
      message: capString(scrubString(e.message || "error"), CAP.msg),
      ...(stack ? { stack: capString(scrubString(stack), CAP.stack) } : {}),
      at: now(),
    });
  };
  const onRejection = (e: PromiseRejectionEvent): void => {
    jsErrors.push({
      message: capString(scrubString(`Unhandled rejection: ${safe(e.reason)}`), CAP.msg),
      at: now(),
    });
  };
  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection, true);

  const origFetch: typeof fetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    try {
      const res = await origFetch(input, init);
      network.push({ method, url: scrubUrl(url), status: res.status, at: now() });
      return res;
    } catch (err) {
      network.push({ method, url: scrubUrl(url), status: 0, at: now() });
      throw err;
    }
  }) as typeof fetch;

  return {
    snapshot(): TechnicalContext {
      return {
        consoleEntries: capArray(consoleEntries, CAP.console),
        jsErrors: capArray(jsErrors, CAP.errors),
        network: capArray(network, CAP.network),
        browser: navigator.userAgent,
        os: navigator.platform || "unknown",
        screen: {
          w: window.screen.width,
          h: window.screen.height,
          dpr: window.devicePixelRatio,
        },
      };
    },
    stop(): void {
      con.log = original.log;
      con.warn = original.warn;
      con.error = original.error;
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
      window.fetch = origFetch;
    },
  };
}
