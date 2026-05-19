import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  canTransitionReviewSession,
  canTransitionTask,
  createAnnotationSchema,
  createReviewSessionSchema,
  inviteReviewerSchema,
  leadSchema,
  projectStatusSchema,
  projectTemplateSchema,
  projectTemplatesSchema,
  providerConfigSchema,
  reviewSessionStatusSchema,
  submitSchema,
  taskActionSchema,
  taskEditSchema,
  updateReviewSessionSchema,
  IMMUTABLE_TASK_STATUSES,
  TASK_TYPES,
  type CreateAnnotationInput,
  type PlatformProviderConfig,
  type PoSourceAnnotation,
  type ProjectTemplate,
  type ProjectTemplates,
  type Reviewer,
  type ReviewerView,
  type SdkSessionIntro,
  type SubmitInput,
  type Task,
  type TaskType,
} from "@speqify/shared";
import { buildPrompt } from "./analysis/prompt.js";
import { parseAnalysisOutput } from "./analysis/schema.js";
import { runAnalysis } from "./analysis/service.js";
import type { LlmProvider } from "./analysis/types.js";
import { authenticate, requireRole } from "./auth/auth.js";
import type { AppConfig } from "./env.js";
import { b64url, encryptJson, hashPassword } from "./lib/crypto.js";
import { ApiException, errorEnvelope } from "./lib/http.js";
import { newId, newSecretToken } from "./lib/ids.js";
import { MEDIA_LIMITS, type MediaStore } from "./media/types.js";
import { requestContext } from "./middleware/context.js";
import { withSdkSession } from "./middleware/sdk-auth.js";
import { body, validateJson } from "./middleware/validate.js";
import type { Repository } from "./repo/types.js";
import { runOnce as runTranscription } from "./transcribe/service.js";
import type { Transcriber, TranscriptionMessage } from "./transcribe/types.js";
import type { AppEnv } from "./types.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(1024),
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

const DEFAULT_TEMPLATES: ProjectTemplates = {
  bug: DEFAULT_TEMPLATE,
  change: DEFAULT_TEMPLATE,
  feature: DEFAULT_TEMPLATE,
  polish: DEFAULT_TEMPLATE,
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
  /** Either the full per-task-type map, or omit to seed with defaults. */
  templates: projectTemplatesSchema.optional(),
});

const transcriptEditSchema = z.object({ transcript: z.string().max(100_000) });

const exportConfigSchema = z.object({
  target: z.enum(["jira", "github", "json", "csv"]),
  credentials: z.record(z.string(), z.string().max(4096)).optional(),
  fieldMapping: z.record(z.string(), z.string().max(200)).default({}),
  defaults: z.record(z.string(), z.string().max(200)).default({}),
});

/** Public reviewer projection — hides the bearer token. */
function toReviewerView(r: Reviewer): ReviewerView {
  const tokenHint = r.token ? r.token.slice(-6) : "";
  const { token: _t, ...rest } = r;
  return { ...rest, tokenHint };
}

/** Build the magic-link URL the reviewer receives in the invitation email. */
function buildInviteUrl(envUrl: string, sessionToken: string, reviewerToken: string): string {
  const u = new URL(envUrl);
  u.searchParams.set("speqify_session", sessionToken);
  u.searchParams.set("speqify_reviewer", reviewerToken);
  return u.toString();
}

export function createApp(deps: {
  repo: Repository;
  config: AppConfig;
  mediaStore: MediaStore;
  transcriber: Transcriber;
  llm: LlmProvider;
}): Hono<AppEnv> {
  const { repo, config, mediaStore, transcriber, llm } = deps;
  const app = new Hono<AppEnv>();

  app.use("*", requestContext);

  // CORS for the SA/PO SPA (separate origin from the API, §3).
  const spaCors = cors({
    origin: config.panelOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
  });
  app.use("/health", spaCors);
  app.use("/admin/*", spaCors);
  app.use("/po/*", spaCors);

  app.get("/health", (c) => c.json({ status: "ok", service: "speqify-api" }));

  // Public closed-beta lead capture from the marketing landing.
  app.use(
    "/leads",
    cors({ origin: "*", allowMethods: ["POST", "OPTIONS"], allowHeaders: ["content-type"] }),
  );
  // The SDK runs on arbitrary host-app origins (it ships as a generic script
  // that activates only when a URL carries the session+reviewer token pair).
  // The token pair is the auth boundary, so CORS is intentionally permissive.
  app.use(
    "/sdk/*",
    cors({
      origin: (o) => o ?? "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["content-type", "x-speqify-session", "x-speqify-reviewer"],
      maxAge: 86400,
    }),
  );

  app.post("/leads", validateJson(leadSchema), async (c) => {
    const b = body<z.infer<typeof leadSchema>>(c);
    const lead = await repo.addLead(b.email, b.locale ?? null);
    await repo.appendAudit({
      kind: "lead.received",
      actor: "landing",
      summary: `Zgłoszenie do bety: ${b.email}`,
      severity: "ok",
      projectId: null,
    });
    return c.json({ ok: true, id: lead.id }, 201);
  });

  // Public media (unguessable keys are the access control, §14).
  app.get("/media/*", async (c) => {
    const key = c.req.path.slice("/media/".length);
    const media = await mediaStore.get(key);
    if (!media) throw new ApiException("not_found", "Media not found");
    return new Response(media.body, {
      headers: {
        "content-type": media.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  });

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
    const password = b.password ?? b64url(crypto.getRandomValues(new Uint8Array(12)));
    const passwordHash = await hashPassword(password);
    try {
      const user = await repo.createUser({
        role: "product_owner",
        email: b.email,
        displayName: b.displayName,
        passwordHash,
      });
      await repo.appendAudit({
        kind: "user.created",
        actor: c.get("session").sub,
        summary: `Utworzono Product Ownera ${user.email}`,
        severity: "ok",
        projectId: null,
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
      templates: b.templates ?? DEFAULT_TEMPLATES,
    });
    await repo.appendAudit({
      kind: "project.created",
      actor: c.get("session").sub,
      summary: `Dodano projekt „${project.name}”`,
      severity: "ok",
      projectId: project.id,
    });
    return c.json(project, 201);
  });

  // --- Review sessions (RS-4) ---

  admin.get("/projects/:id/sessions", async (c) => {
    const project = await repo.getProject(c.req.param("id"));
    if (!project) throw new ApiException("not_found", "Project not found");
    return c.json({ sessions: await repo.listReviewSessionsByProject(project.id) });
  });

  admin.post(
    "/projects/:id/sessions",
    validateJson(createReviewSessionSchema),
    async (c) => {
      const project = await repo.getProject(c.req.param("id"));
      if (!project) throw new ApiException("not_found", "Project not found");
      const b = body<z.infer<typeof createReviewSessionSchema>>(c);
      const session = await repo.createReviewSession({
        projectId: project.id,
        name: b.name,
        description: b.description,
        instructions: b.instructions,
        envUrl: b.envUrl,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        createdBy: c.get("session").sub,
        token: newSecretToken(),
      });
      await repo.appendAudit({
        kind: "session.created",
        actor: c.get("session").sub,
        summary: `Utworzono sesję review „${session.name}” w „${project.name}”`,
        severity: "ok",
        projectId: project.id,
      });
      return c.json(session, 201);
    },
  );

  admin.get("/sessions/:id", async (c) => {
    const session = await repo.getReviewSession(c.req.param("id"));
    if (!session) throw new ApiException("not_found", "Session not found");
    const reviewers = await repo.listReviewersBySession(session.id);
    return c.json({ session, reviewers: reviewers.map(toReviewerView) });
  });

  admin.patch("/sessions/:id", validateJson(updateReviewSessionSchema), async (c) => {
    const session = await repo.getReviewSession(c.req.param("id"));
    if (!session) throw new ApiException("not_found", "Session not found");
    const b = body<z.infer<typeof updateReviewSessionSchema>>(c);
    const updated = await repo.updateReviewSession(session.id, b);
    if (!updated) throw new ApiException("not_found", "Session not found");
    return c.json(updated);
  });

  admin.post("/sessions/:id/status", validateJson(reviewSessionStatusSchema), async (c) => {
    const session = await repo.getReviewSession(c.req.param("id"));
    if (!session) throw new ApiException("not_found", "Session not found");
    const { status } = body<z.infer<typeof reviewSessionStatusSchema>>(c);
    if (status !== session.status && !canTransitionReviewSession(session.status, status)) {
      throw new ApiException(
        "bad_request",
        `Cannot transition session from "${session.status}" to "${status}"`,
      );
    }
    const updated = await repo.setReviewSessionStatus(session.id, status);
    if (!updated) throw new ApiException("not_found", "Session not found");
    const kind = status === "live" ? "session.published" : `session.${status}`;
    await repo.appendAudit({
      kind,
      actor: c.get("session").sub,
      summary: `Sesja „${updated.name}” → ${status}`,
      severity: status === "closed" ? "warn" : "ok",
      projectId: updated.projectId,
    });
    return c.json({ id: updated.id, status: updated.status });
  });

  admin.post(
    "/sessions/:id/reviewers",
    validateJson(inviteReviewerSchema),
    async (c) => {
      const session = await repo.getReviewSession(c.req.param("id"));
      if (!session) throw new ApiException("not_found", "Session not found");
      const b = body<z.infer<typeof inviteReviewerSchema>>(c);
      const reviewer = await repo.addReviewer({
        sessionId: session.id,
        name: b.name,
        email: b.email,
        token: newSecretToken(),
      });
      const inviteUrl = buildInviteUrl(session.envUrl, session.token, reviewer.token);
      // RS-5 will plug in Resend here; for now we always return the URL so the
      // PO can copy/paste it. This stays the graceful-fallback path even once
      // Resend is wired (notes §RS-5).
      const emailSent = false;
      await repo.appendAudit({
        kind: "reviewer.invited",
        actor: c.get("session").sub,
        summary: `Zaproszono ${reviewer.email} do sesji „${session.name}”`,
        severity: "ok",
        projectId: session.projectId,
      });
      return c.json(
        { reviewer: toReviewerView(reviewer), inviteUrl, emailSent },
        201,
      );
    },
  );

  admin.delete("/sessions/:id/reviewers/:rid", async (c) => {
    const session = await repo.getReviewSession(c.req.param("id"));
    if (!session) throw new ApiException("not_found", "Session not found");
    const reviewer = await repo.getReviewer(c.req.param("rid"));
    if (!reviewer || reviewer.sessionId !== session.id) {
      throw new ApiException("not_found", "Reviewer not found");
    }
    const updated = await repo.revokeReviewer(reviewer.id);
    if (!updated) throw new ApiException("not_found", "Reviewer not found");
    await repo.appendAudit({
      kind: "reviewer.revoked",
      actor: c.get("session").sub,
      summary: `Odebrano dostęp ${updated.email} (sesja „${session.name}”)`,
      severity: "warn",
      projectId: session.projectId,
    });
    return c.json({ id: updated.id, status: updated.status });
  });

  admin.post("/sessions/:id/reviewers/:rid/resend", async (c) => {
    const session = await repo.getReviewSession(c.req.param("id"));
    if (!session) throw new ApiException("not_found", "Session not found");
    const reviewer = await repo.getReviewer(c.req.param("rid"));
    if (!reviewer || reviewer.sessionId !== session.id) {
      throw new ApiException("not_found", "Reviewer not found");
    }
    if (reviewer.status === "declined") {
      throw new ApiException("bad_request", "Reviewer access was revoked");
    }
    const inviteUrl = buildInviteUrl(session.envUrl, session.token, reviewer.token);
    // Resend hook lands in RS-5; for now we just return the same URL again.
    return c.json({ inviteUrl, emailSent: false });
  });

  // --- SA dashboard real data (Tranche B) ---

  admin.get("/stats", async (c) => c.json(await repo.getAdminStats()));

  admin.get("/audit", async (c) => {
    const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
    return c.json({ entries: await repo.listAudit(limit) });
  });

  admin.post("/projects/:id/status", validateJson(projectStatusSchema), async (c) => {
    const project = await repo.getProject(c.req.param("id"));
    if (!project) throw new ApiException("not_found", "Project not found");
    const { status } = body<z.infer<typeof projectStatusSchema>>(c);
    const updated = await repo.setProjectStatus(project.id, status);
    if (!updated) throw new ApiException("not_found", "Project not found");
    await repo.appendAudit({
      kind: "project.status",
      actor: c.get("session").sub,
      summary: `Projekt „${updated.name}” → ${status}`,
      severity: status === "archived" ? "warn" : "ok",
      projectId: updated.id,
    });
    return c.json({ id: updated.id, status: updated.status });
  });

  admin.get("/providers", async (c) => c.json({ config: await repo.getPlatformConfig() }));

  admin.put("/providers", validateJson(providerConfigSchema), async (c) => {
    const b = body<z.infer<typeof providerConfigSchema>>(c);
    const key = b.aiKey?.trim();
    const aiKeyRef = key ? await encryptJson(config.envelopeKey, { aiKey: key }) : null;
    const aiKeyHint = key ? key.slice(-4) : null;
    const cfg: PlatformProviderConfig = {
      aiProvider: b.aiProvider,
      aiModel: b.aiModel,
      ...(b.aiEndpoint ? { aiEndpoint: b.aiEndpoint } : {}),
      transcriptionProvider: b.transcriptionProvider,
      ...(b.transcriptionEndpoint ? { transcriptionEndpoint: b.transcriptionEndpoint } : {}),
    };
    const view = await repo.setPlatformConfig({ config: cfg, aiKeyRef, aiKeyHint });
    await repo.appendAudit({
      kind: "providers.updated",
      actor: c.get("session").sub,
      summary: `Zaktualizowano dostawcę AI: ${cfg.aiProvider}/${cfg.aiModel}`,
      severity: "ok",
      projectId: null,
    });
    return c.json({ config: view });
  });

  admin.post("/transcribe/run", async (c) => {
    const batch = Number(c.req.query("batch")) || 20;
    const lang = c.req.query("lang");
    const r = await runTranscription(
      { repo, mediaStore, transcriber },
      { batch, ...(lang ? { languageHint: lang } : {}) },
    );
    return c.json(r);
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
        templates: project.templates,
      },
      export: ec
        ? { target: ec.target, fieldMapping: ec.fieldMapping, defaults: ec.defaults }
        : null,
    });
  });

  // Per-type templates: PO sends the full ProjectTemplates map; we also accept
  // a single { taskType, template } body so the panel can update one tab at a
  // time without round-tripping all four.
  po.put(
    "/project/templates",
    validateJson(
      z.union([
        projectTemplatesSchema,
        z.object({
          taskType: z.enum(["bug", "change", "feature", "polish"]),
          template: projectTemplateSchema,
        }),
      ]),
    ),
    async (c) => {
      const project = await resolvePoProject(c);
      if (!project) throw new ApiException("not_found", "No project for this account");
      const b = body<
        | ProjectTemplates
        | { taskType: TaskType; template: ProjectTemplate }
      >(c);
      const next: ProjectTemplates =
        "taskType" in b
          ? { ...project.templates, [b.taskType]: b.template }
          : b;
      // Defensive: ensure all four keys are populated even if the caller sent
      // a partial bundle (shouldn't happen via the schema, but cheap).
      for (const t of TASK_TYPES) {
        if (!next[t]) next[t] = project.templates[t] ?? DEFAULT_TEMPLATE;
      }
      const updated = await repo.updateProjectTemplates(project.id, next);
      return c.json(updated);
    },
  );

  po.put("/project/export", validateJson(exportConfigSchema), async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const b = body<z.infer<typeof exportConfigSchema>>(c);
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

  po.put("/annotations/:id/transcript", validateJson(transcriptEditSchema), async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const ann = await repo.getAnnotationById(c.req.param("id"));
    if (!ann) throw new ApiException("not_found", "Annotation not found");
    const session = await repo.getReviewSession(ann.sessionId);
    if (!session || session.projectId !== project.id) {
      throw new ApiException("forbidden", "Not your annotation");
    }
    const b = body<z.infer<typeof transcriptEditSchema>>(c);
    await repo.setTranscription(ann.id, b.transcript, "done");
    return c.json({ ok: true });
  });

  po.post("/analyze", async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const res = await runAnalysis({ repo, llm }, project);
    if (res.locked) throw new ApiException("conflict", "Analysis already running");
    await repo.appendAudit({
      kind: "analysis.finished",
      actor: c.get("session").sub,
      summary: `Analiza AI dla „${project.name}”: ${res.annotations} adnotacji → ${res.tasksCreated} zadań (${res.status})`,
      severity: res.status === "succeeded" ? "ok" : "danger",
      projectId: project.id,
    });
    return c.json(res);
  });

  po.get("/tasks", async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    return c.json({ tasks: await repo.listTasks(project.id) });
  });

  // --- PO review (Phase 8) ---

  const ownedTask = async (c: Context<AppEnv>): Promise<Task> => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const id = c.req.param("id") ?? "";
    const task = id ? await repo.getTask(id) : null;
    if (!task || task.projectId !== project.id) {
      throw new ApiException("not_found", "Task not found");
    }
    return task;
  };

  const applyMutation = (
    r: { ok: true; task: Task } | { ok: false; reason: "not_found" | "conflict" },
  ): Task => {
    if (r.ok) return r.task;
    if (r.reason === "conflict") {
      throw new ApiException("conflict", "Task changed since you loaded it — reload and retry");
    }
    throw new ApiException("not_found", "Task not found");
  };

  po.get("/tasks/:id", async (c) => c.json({ task: await ownedTask(c) }));

  po.get("/tasks/:id/annotations", async (c) => {
    const task = await ownedTask(c);
    const anns = await repo.getAnnotationsByIds(task.annotationIds);
    const out: PoSourceAnnotation[] = anns.map((a) => ({
      id: a.id,
      type: a.type,
      selector: a.element?.selector ?? null,
      textNote: a.textNote,
      transcript: a.transcript,
      transcriptionStatus: a.transcriptionStatus,
      voiceUrl: a.voice?.publicUrl ?? a.recordingAudio?.publicUrl ?? null,
      screenshotUrl: a.screenshot?.publicUrl ?? null,
      tags: a.tags,
      structured: a.structured,
      createdAt: a.serverCreatedAt,
    }));
    return c.json({ annotations: out });
  });

  const reviewTransition = (target: "accepted" | "rejected") => async (c: Context<AppEnv>) => {
    const task = await ownedTask(c);
    const b = body<z.infer<typeof taskActionSchema>>(c);
    if (!canTransitionTask(task.status, target)) {
      throw new ApiException(
        "bad_request",
        `Cannot ${target === "accepted" ? "accept" : "reject"} a task in "${task.status}"`,
      );
    }
    const r = await repo.updateTask(task.id, b.expectedRev, {
      status: target,
      reviewedAt: new Date().toISOString(),
    });
    const out = applyMutation(r);
    await repo.appendAudit({
      kind: `task.${target}`,
      actor: c.get("session").sub,
      summary: `Zadanie „${out.title.slice(0, 80)}” → ${target}`,
      severity: target === "rejected" ? "warn" : "ok",
      projectId: out.projectId,
    });
    return c.json({ task: out });
  };

  po.post("/tasks/:id/accept", validateJson(taskActionSchema), reviewTransition("accepted"));
  po.post("/tasks/:id/reject", validateJson(taskActionSchema), reviewTransition("rejected"));

  po.put("/tasks/:id", validateJson(taskEditSchema), async (c) => {
    const task = await ownedTask(c);
    if (IMMUTABLE_TASK_STATUSES.includes(task.status)) {
      throw new ApiException("bad_request", `A "${task.status}" task can no longer be edited`);
    }
    const b = body<z.infer<typeof taskEditSchema>>(c);
    const r = await repo.updateTask(task.id, b.expectedRev, {
      title: b.title,
      description: b.description,
      acceptanceCriteria: b.acceptanceCriteria,
      labels: b.labels,
      component: b.component,
      version: b.version,
      priority: b.priority,
      subtaskType: b.subtaskType,
    });
    return c.json({ task: applyMutation(r) });
  });

  po.post("/tasks/:id/regenerate", validateJson(taskActionSchema), async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const id = c.req.param("id") ?? "";
    const task = id ? await repo.getTask(id) : null;
    if (!task || task.projectId !== project.id) {
      throw new ApiException("not_found", "Task not found");
    }
    if (IMMUTABLE_TASK_STATUSES.includes(task.status)) {
      throw new ApiException("bad_request", `A "${task.status}" task can no longer be regenerated`);
    }
    const b = body<z.infer<typeof taskActionSchema>>(c);
    const anns = await repo.getAnnotationsByIds(task.annotationIds);
    if (anns.length === 0) {
      throw new ApiException("bad_request", "Task has no source annotations to regenerate from");
    }
    const out = parseAnalysisOutput(await llm.complete(buildPrompt(project, anns)));
    const fresh = out?.tasks[0];
    if (!fresh) throw new ApiException("bad_request", "Regeneration did not return a valid task");
    const r = await repo.updateTask(task.id, b.expectedRev, {
      title: fresh.title,
      description: fresh.description,
      acceptanceCriteria: fresh.acceptanceCriteria,
      labels: fresh.labels,
      component: fresh.component,
      version: fresh.version,
      priority: fresh.priority,
      confidence: fresh.confidence,
    });
    return c.json({ task: applyMutation(r) });
  });

  po.post("/tasks/export", async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const format = c.req.query("format") === "csv" ? "csv" : "json";
    const all = await repo.listTasks(project.id);
    const exportable = all.filter((t) => t.status === "accepted" || t.status === "exported");
    if (exportable.length === 0) {
      throw new ApiException("bad_request", "No accepted tasks to export");
    }

    let newlyExported = 0;
    const final: Task[] = [];
    for (const t of exportable) {
      if (t.status === "accepted" && canTransitionTask(t.status, "exported")) {
        const r = await repo.updateTask(t.id, t.rev, {
          status: "exported",
          externalId: t.externalId ?? `speqify:${t.id}`,
          exportError: null,
        });
        if (r.ok) {
          newlyExported++;
          final.push(r.task);
          continue;
        }
      }
      final.push(t);
    }

    const dto = (t: Task) => ({
      id: t.id,
      externalId: t.externalId ?? `speqify:${t.id}`,
      parentTaskId: t.parentTaskId,
      status: t.status,
      title: t.title,
      description: t.description,
      acceptanceCriteria: t.acceptanceCriteria,
      labels: t.labels,
      component: t.component,
      version: t.version,
      priority: t.priority,
      subtaskType: t.subtaskType,
      confidence: t.confidence,
      annotationIds: t.annotationIds,
    });

    let content: string;
    if (format === "csv") {
      const cols = [
        "externalId",
        "parentTaskId",
        "status",
        "title",
        "description",
        "acceptanceCriteria",
        "labels",
        "component",
        "version",
        "priority",
        "subtaskType",
        "confidence",
      ] as const;
      const esc = (v: unknown): string => {
        const s = Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = final.map((t) => {
        const d = dto(t) as Record<string, unknown>;
        return cols.map((k) => esc(d[k])).join(",");
      });
      content = [cols.join(","), ...rows].join("\r\n");
    } else {
      content = JSON.stringify(
        { schema: "speqify.tasks/v1", project: project.id, tasks: final.map(dto) },
        null,
        2,
      );
    }

    await repo.appendAudit({
      kind: "export.completed",
      actor: c.get("session").sub,
      summary: `Eksport ${format.toUpperCase()}: ${final.length} zadań (${newlyExported} nowo wyeksportowanych)`,
      severity: "ok",
      projectId: project.id,
    });

    return c.json({
      format,
      total: final.length,
      newlyExported,
      filename: `speqify-${project.id}-tasks.${format}`,
      content,
    });
  });

  app.route("/po", po);

  // --- SDK ingest (token-pair gated) ---
  const sdk = new Hono<AppEnv>();

  /**
   * Intro / welcome bootstrap. Public to any host origin; the token pair is
   * the gate. Idempotently flips reviewer.pending → active and returns the
   * copy the SDK renders in the welcome modal.
   */
  sdk.get(
    "/sessions/:sessionToken/intro",
    withSdkSession(repo, { sessionTokenParam: "sessionToken", reviewerTokenQuery: "reviewer" }),
    async (c) => {
      const session = c.get("reviewSession");
      const reviewer = c.get("reviewer");
      const wasPending = reviewer.status === "pending";
      const accepted = await repo.markReviewerAccepted(reviewer.id);
      if (wasPending && accepted?.status === "active") {
        await repo.appendAudit({
          kind: "reviewer.accepted",
          actor: reviewer.email,
          summary: `Reviewer ${reviewer.email} dołączył do sesji „${session.name}”`,
          severity: "ok",
          projectId: session.projectId,
        });
      }
      const project = await repo.getProject(session.projectId);
      const firstName = (accepted ?? reviewer).name.trim().split(/\s+/)[0] ?? "";
      const intro: SdkSessionIntro = {
        projectName: project?.name ?? "",
        sessionName: session.name,
        description: session.description,
        instructions: session.instructions,
        reviewerName: firstName,
      };
      return c.json(intro);
    },
  );

  sdk.post(
    "/submissions/:submissionId/annotations",
    withSdkSession(repo),
    validateJson(createAnnotationSchema),
    async (c) => {
      const session = c.get("reviewSession");
      const reviewer = c.get("reviewer");
      const input = body<CreateAnnotationInput>(c);
      // The submissionId in the URL must agree with the body's; the body
      // value is what the schema accepted, so reject mismatches early.
      const submissionId = c.req.param("submissionId");
      if (submissionId !== input.submissionId) {
        throw new ApiException("bad_request", "submissionId mismatch");
      }
      await repo.getOrCreateSubmission({
        sessionId: session.id,
        reviewerId: reviewer.id,
        submissionId: input.submissionId,
        clientId: input.clientId,
      });
      const { annotation, created } = await repo.upsertAnnotation({
        sessionId: session.id,
        reviewerId: reviewer.id,
        correlationId: c.get("correlationId"),
        input,
      });
      await repo.markReviewerSeen(reviewer.id, new Date().toISOString());
      return c.json({ id: annotation.id, created }, created ? 201 : 200);
    },
  );

  sdk.post(
    "/submissions/:submissionId/complete",
    withSdkSession(repo),
    validateJson(submitSchema),
    async (c) => {
      const session = c.get("reviewSession");
      const input = body<SubmitInput>(c);
      const submissionId = c.req.param("submissionId");
      if (submissionId !== input.submissionId) {
        throw new ApiException("bad_request", "submissionId mismatch");
      }
      const ok = await repo.completeSubmission({
        sessionId: session.id,
        submissionId: input.submissionId,
      });
      if (!ok) throw new ApiException("not_found", "Submission not found");
      await repo.appendAudit({
        kind: "annotation.submitted",
        actor: c.get("reviewer").email,
        summary: `Reviewer ${c.get("reviewer").email} wysłał batch w sesji „${session.name}”`,
        severity: "ok",
        projectId: session.projectId,
      });
      const queue = c.env?.TRANSCRIPTION_QUEUE;
      if (queue) {
        const msg: TranscriptionMessage = {
          kind: "transcribe",
          sessionId: session.id,
          submissionId: input.submissionId,
        };
        try {
          c.executionCtx.waitUntil(queue.send(msg).catch(() => {}));
        } catch {
          /* no execution context (unit tests) — sweep/consumer still covers it */
        }
      }
      return c.json({ complete: true });
    },
  );

  sdk.post("/uploads", withSdkSession(repo), async (c) => {
    const session = c.get("reviewSession");
    const reviewer = c.get("reviewer");
    const kind = c.req.query("kind") ?? "";
    const limit = MEDIA_LIMITS[kind];
    if (limit === undefined) throw new ApiException("bad_request", "Unknown media kind");
    const buf = await c.req.arrayBuffer();
    if (buf.byteLength === 0) throw new ApiException("bad_request", "Empty upload");
    if (buf.byteLength > limit) throw new ApiException("bad_request", "Media too large");
    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    const bucketKey = `sessions/${session.id}/reviewers/${reviewer.id}/${kind}/${newId()}`;
    await mediaStore.put(bucketKey, buf, contentType);
    const publicUrl = new URL(`/media/${bucketKey}`, c.req.url).href;
    return c.json({ bucketKey, contentType, bytes: buf.byteLength, publicUrl }, 201);
  });

  app.route("/sdk", sdk);

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
