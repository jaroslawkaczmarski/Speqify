import { renderToString } from "react-dom/server";
import { App } from "./App";

/** Render the landing to static HTML at build time (see prerender.mjs).
 *  The client then hydrates the same tree in main.tsx. */
export function render(): string {
  return renderToString(<App />);
}
