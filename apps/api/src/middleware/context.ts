import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types.js";

/**
 * Correlation id + structured request log. The id flows SDK -> API -> queue ->
 * workflow -> export so a single feedback item is traceable end to end (§14).
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const correlationId = c.req.header("x-correlation-id") ?? crypto.randomUUID();
  c.set("correlationId", correlationId);
  c.header("x-correlation-id", correlationId);

  const start = Date.now();
  await next();

  console.log(
    JSON.stringify({
      level: "info",
      msg: "request",
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      ms: Date.now() - start,
      correlationId,
    }),
  );
});
