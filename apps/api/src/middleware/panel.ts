import { createMiddleware } from "hono/factory";
import { ApiException } from "../lib/http.js";
import type { Repository } from "../repo/types.js";
import type { AppEnv } from "../types.js";

/** Resolves the capability token (path param) to a Panel or 404 (§9, §14). */
export function withPanel(repo: Repository) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.param("token");
    if (!token) throw new ApiException("not_found", "Panel not found");
    const panel = await repo.getPanelByToken(token);
    if (!panel) throw new ApiException("not_found", "Panel not found");
    c.set("panel", panel);
    await next();
  });
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Ingest/submit guard: panel must be `open`, and a browser Origin (when present)
 * must match the panel's configured environment (CORS allowlist, §9).
 */
export const requireOpenPanel = createMiddleware<AppEnv>(async (c, next) => {
  const panel = c.get("panel");
  if (panel.status !== "open") {
    throw new ApiException("panel_closed", "This panel is closed for submissions");
  }
  const origin = c.req.header("origin");
  if (origin && originOf(panel.environmentUrl) !== origin) {
    throw new ApiException("forbidden", "Origin not allowed for this panel");
  }
  await next();
});
