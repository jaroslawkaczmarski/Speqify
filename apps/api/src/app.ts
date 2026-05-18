import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import {
  createAnnotationSchema,
  submitSchema,
  type CreateAnnotationInput,
  type ProjectTemplate,
  type SubmitInput,
} from "@speqify/shared";
import { authenticate, requireRole } from "./auth/auth.js";
import type { AppConfig } from "./env.js";
import { b64url, encryptJson, hashPassword } from "./lib/crypto.js";
import { ApiException, errorEnvelope } from "./lib/http.js";
import { newSecretToken } from "./lib/ids.js";
import { requestContext } from "./middleware/context.js";
import { requireOpenPanel, withPanel } from "./middleware/panel.js";
import { body, validateJson } from "./middleware/validate.js";
import type { Repository } from "./repo/types.js";
import type { AppEnv } from "./types.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(1024),
});

const templateSchema = z.object({
  language: z.enum(["pl", "en"]),
  userStory: z.boolean(),
  acceptanceCriteria: z.boolean(),
  labels: z.array(z.string().max(64)).max(50),
  components: z.array(z.string().max(64)).max(50),
  versions: z.array(z.string().max(64)).max(50),
  customFields: z.record(z.string().max(200)),
});

const DEFAULT_TEMPLATE: ProjectTemplate = {
  language: "en",
  userStory: true,
  acceptanceCriteria: true,
  labels: [],
  components: [],
  versions: [],
  customFields: {},
};

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  password: z.string().min(8).max(1024).optional(),
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  productOwnerId: z.string().min(1).max(64),
  environmentUrls: z.array(z.string().url()).min(1).max(20),
  template: templateSchema.optional(),
});

const createPanelSchema = z.object({
  audience: z.enum(["client", "tester", "po"]),
  environmentUrl: z.string().url(),
});

const exportConfigSchema = z.object({
  target: z.enum(["jira", "github", "json", "csv"]),
  credentials: z.record(z.string().max(4096)).optional(),
  fieldMapping: z.record(z.string().max(200)).default({}),
  defaults: z.record(z.string().max(200)).default({}),
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

  // --- SuperAdmin (Phase 2) ---
  const admin = new Hono<AppEnv>();
  admin.use("*", requireRole(config, ["superadmin"]));

  admin.post("/users", validateJson(createUserSchema), async (c) => {
    const b = body<z.infer<typeof createUserSchema>>(c);
    // Generated password is returned ONCE (SA shares it with the PO, §11).
    const password = b.password ?? b64url(crypto.getRandomValues(new Uint8Array(12)));
    const passwordHash = await hashPassword(password);
    try {
      const user = await repo.createUser({
        role: "product_owner",
        email: b.email,
        displayName: b.displayName,
        passwordHash,
      });
      return c.json({ id: user.id, email: user.email, password }, 201);
    } catch {
      throw new ApiException("conflict", "Email already exists");
    }
  });

  admin.get("/users", async (c) => c.json({ users: await repo.listUsers() }));

  admin.get("/projects", async (c) => c.json({ projects: await repo.listProjects() }));

  admin.post("/projects", validateJson(createProjectSchema), async (c) => {
    const b = body<z.infer<typeof createProjectSchema>>(c);
    const project = await repo.createProject({
      name: b.name,
      productOwnerId: b.productOwnerId,
      environmentUrls: b.environmentUrls,
      template: b.template ?? DEFAULT_TEMPLATE,
    });
    return c.json(project, 201);
  });

  admin.get("/projects/:id/panels", async (c) => {
    const project = await repo.getProject(c.req.param("id"));
    if (!project) throw new ApiException("not_found", "Project not found");
    return c.json({ panels: await repo.listPanels(project.id) });
  });

  admin.post("/projects/:id/panels", validateJson(createPanelSchema), async (c) => {
    const project = await repo.getProject(c.req.param("id"));
    if (!project) throw new ApiException("not_found", "Project not found");
    const b = body<z.infer<typeof createPanelSchema>>(c);
    const secretToken = newSecretToken();
    const panel = await repo.createPanel({
      projectId: project.id,
      audience: b.audience,
      environmentUrl: b.environmentUrl,
      secretToken,
    });
    const sep = b.environmentUrl.includes("?") ? "&" : "?";
    return c.json(
      { id: panel.id, secretToken, panelUrl: `${b.environmentUrl}${sep}speqify=${secretToken}` },
      201,
    );
  });

  app.route("/admin", admin);

  // --- Product Owner config (Phase 3) ---
  const po = new Hono<AppEnv>();
  po.use("*", requireRole(config, ["product_owner", "superadmin"]));

  const resolvePoProject = async (c: Context<AppEnv>) => {
    const s = c.get("session");
    if (s.role === "product_owner") return repo.getProjectByOwner(s.sub);
    const pid = c.req.query("projectId");
    return pid ? repo.getProject(pid) : null;
  };

  po.get("/project", async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const ec = await repo.getExportConfig(project.id);
    return c.json({
      project: {
        id: project.id,
        name: project.name,
        environmentUrls: project.environmentUrls,
        template: project.template,
      },
      export: ec
        ? { target: ec.target, fieldMapping: ec.fieldMapping, defaults: ec.defaults }
        : null,
    });
  });

  po.put("/project/template", validateJson(templateSchema), async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const t = body<z.infer<typeof templateSchema>>(c);
    const updated = await repo.updateProjectTemplate(project.id, t);
    return c.json(updated);
  });

  po.put("/project/export", validateJson(exportConfigSchema), async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const b = body<z.infer<typeof exportConfigSchema>>(c);
    // Credentials are envelope-encrypted at rest; never returned to clients (§9).
    const encryptedCredentialsRef =
      b.credentials && Object.keys(b.credentials).length > 0
        ? await encryptJson(config.envelopeKey, b.credentials)
        : null;
    const ec = await repo.upsertExportConfig({
      projectId: project.id,
      target: b.target,
      encryptedCredentialsRef,
      fieldMapping: b.fieldMapping,
      defaults: b.defaults,
    });
    return c.json({ configured: true, target: ec.target });
  });

  po.post("/project/export/test", async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const ec = await repo.getExportConfig(project.id);
    if (!ec) throw new ApiException("bad_request", "No export target configured");
    const needsCreds = ec.target === "jira" || ec.target === "github";
    const checks = [
      { name: "target_selected", ok: true },
      {
        name: "credentials_present",
        ok: !needsCreds || ec.encryptedCredentialsRef !== null,
      },
    ];
    if (ec.target === "jira") {
      checks.push({ name: "jira_project_key", ok: Boolean(ec.defaults["projectKey"]) });
      checks.push({ name: "jira_issue_type", ok: Boolean(ec.defaults["issueType"]) });
    }
    if (ec.target === "github") {
      checks.push({ name: "github_repo", ok: Boolean(ec.defaults["repo"]) });
    }
    return c.json({
      ok: checks.every((x) => x.ok),
      target: ec.target,
      checks,
      note: "Config validation only — live Jira/GitHub probe lands in Phase 9.",
    });
  });

  app.route("/po", po);

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
