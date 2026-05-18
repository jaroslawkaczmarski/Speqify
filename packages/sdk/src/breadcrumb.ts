/** Lightweight navigation/action breadcrumb -> reproduction steps (§13). */
import type { NavigationStep } from "@speqify/shared";
import { capArray } from "./scrub.js";

export interface Breadcrumb {
  steps(): NavigationStep[];
  stop(): void;
}

export function startBreadcrumb(max = 50): Breadcrumb {
  const steps: NavigationStep[] = [];
  const push = (action?: string): void => {
    steps.push({ url: location.href, at: new Date().toISOString(), ...(action ? { action } : {}) });
  };
  push("load");

  const origPush: History["pushState"] = history.pushState.bind(history);
  const origReplace: History["replaceState"] = history.replaceState.bind(history);
  history.pushState = ((...a: Parameters<History["pushState"]>) => {
    origPush(...a);
    push("navigate");
  }) as History["pushState"];
  history.replaceState = ((...a: Parameters<History["replaceState"]>) => {
    origReplace(...a);
    push("navigate");
  }) as History["replaceState"];

  const onPop = (): void => push("back");
  const onClick = (e: MouseEvent): void => {
    const t = e.target as Element | null;
    if (t) push(`click ${t.tagName.toLowerCase()}`);
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("click", onClick, true);

  return {
    steps: () => capArray(steps, max),
    stop: () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("click", onClick, true);
    },
  };
}
