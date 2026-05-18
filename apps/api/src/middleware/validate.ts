import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { ZodTypeAny, z } from "zod";
import { ApiException } from "../lib/http.js";
import type { AppEnv } from "../types.js";

/**
 * JSON body validation. All captured content is untrusted — these schemas
 * bound shape/size only (prompt-injection hardening lives downstream, §14).
 */
export function validateJson<S extends ZodTypeAny>(schema: S) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new ApiException("bad_request", "Body must be valid JSON");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const where = first?.path.join(".") || "body";
      throw new ApiException("bad_request", `Invalid ${where}: ${first?.message ?? "invalid"}`);
    }
    c.set("body", parsed.data);
    await next();
  });
}

export function body<T>(c: Context<AppEnv>): T {
  return c.get("body") as T;
}

export type Infer<S extends ZodTypeAny> = z.infer<S>;
