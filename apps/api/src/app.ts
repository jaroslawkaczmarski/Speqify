import { Hono } from "hono";
import { z } from "zod";
import {
  createAnnotationSchema,
  submitSchema,
  type CreateAnnotationInput,
  type SubmitInput,
} from "@speqify/shared";
import { authenticate, requireRole } from "./auth/auth.js";
import type { AppConfig } from "./env.js";
import { ApiException, errorEnvelope } from "./lib/http.js";
import { requestContext } from "./middleware/context.js";
import { requireOpenPanel, withPanel } from "./middleware/panel.js";
import { body, validateJson } from "./middleware/validate.js";
import type { Repository } from "./repo/types.js";
import type { AppEnv } from "./types.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(1024),
});

export function createApp(deps: { repo: Repository; config: AppConfig }): Hono<AppEnv> {
  const { repo, config } = deps;
  const app = new Hono<AppEnv>();

  app.use("*", requestContext);

  app.get("/health", (c) => c.json({ status: "ok", service: "speqify-api" }));

  // --- Admin / auth ---
  app.post("/admin/login", validateJson(loginSchema), async (c) => {
    const { email, password } = body<z.infer<typeof loginSchema>>(c);
    const result = await authenticate(repo, config, email, password);
    if (!result) throw new ApiException("unauthorized", "Invalid email or password");
    return c.json({ token: result.token, role: result.role });
  });

  app.get("/admin/me", requireRole(config, ["superadmin", "product_owner"]), (c) => {
    const s = c.get("session");
    return c.json({ sub: s.sub, role: s.role, exp: s.exp });
  });

  // --- Panel (capability-token) ---
  const panel = new Hono<AppEnv>();
  panel.use("/:token", withPanel(repo));
  panel.use("/:token/*", withPanel(repo));

  panel.get("/:token", (c) => {
    const p = c.get("panel");
    return c.json({
      panelId: p.id,
      audience: p.audience,
      status: p.status,
      environmentUrl: p.environmentUrl,
    });
  });

  panel.post(
    "/:token/annotations",
    requireOpenPanel,
    validateJson(createAnnotationSchema),
    async (c) => {
      const p = c.get("panel");
      const input = body<CreateAnnotationInput>(c);
      await repo.getOrCreateSubmission({
        panelId: p.id,
        submissionId: input.submissionId,
        clientId: input.clientId,
      });
      const { annotation, created } = await repo.upsertAnnotation({
        panelId: p.id,
        audience: p.audience,
        correlationId: c.get("correlationId"),
        input,
      });
      return c.json({ id: annotation.id, created }, created ? 201 : 200);
    },
  );

  panel.post("/:token/submit", requireOpenPanel, validateJson(submitSchema), async (c) => {
    const p = c.get("panel");
    const input = body<SubmitInput>(c);
    const ok = await repo.completeSubmission({
      panelId: p.id,
      submissionId: input.submissionId,
    });
    if (!ok) throw new ApiException("not_found", "Submission not found");
    return c.json({ complete: true });
  });

  app.route("/panels", panel);

  // --- Error envelope (§9, §14: every response traceable) ---
  app.notFound((c) =>
    c.json(errorEnvelope("not_found", "Route not found", c.get("correlationId") ?? ""), 404),
  );

  app.onError((err, c) => {
    const cid = c.get("correlationId") ?? "";
    if (err instanceof ApiException) {
      return c.json(errorEnvelope(err.code, err.detail, cid), err.status);
    }
    console.log(
      JSON.stringify({
        level: "error",
        msg: "unhandled",
        error: err instanceof Error ? err.message : String(err),
        correlationId: cid,
      }),
    );
    return c.json(errorEnvelope("internal_error", "Unexpected error", cid), 500);
  });

  return app;
}
