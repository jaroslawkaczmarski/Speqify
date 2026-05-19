import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  canTransitionTask,
  createAnnotationSchema,
  leadSchema,
  projectStatusSchema,
  providerConfigSchema,
  submitSchema,
  taskActionSchema,
  taskEditSchema,
  IMMUTABLE_TASK_STATUSES,
  type CreateAnnotationInput,
  type PlatformProviderConfig,
  type PoSourceAnnotation,
  type ProjectTemplate,
  type SubmitInput,
  type Task,
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
import { requireOpenPanel, withPanel } from "./middleware/panel.js";
import { body, validateJson } from "./middleware/validate.js";
import type { Repository } from "./repo/types.js";
import { runOnce as runTranscription } from "./transcribe/service.js";
import type { Transcriber, TranscriptionMessage } from "./transcribe/types.js";
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

const panelStatusSchema = z.object({ status: z.enum(["open", "closed"]) });

const transcriptEditSchema = z.object({ transcript: z.string().max(100_000) });

const exportConfigSchema = z.object({
  target: z.enum(["jira", "github", "json", "csv"]),
  credentials: z.record(z.string().max(4096)).optional(),
  fieldMapping: z.record(z.string().max(200)).default({}),
  defaults: z.record(z.string().max(200)).default({}),
});

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

  // CORS for the SA/PO SPA (separate origin from the API, §3). Panel
  // capability-token ingest keeps its own per-project Origin allowlist.
  const spaCors = cors({
    origin: config.panelOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
  });
  app.use("/health", spaCors);
  app.use("/admin/*", spaCors);
  app.use("/po/*", spaCors);

  app.get("/health", (c) => c.json({ status: "ok", service: "speqify-api" }));

  // Public closed-beta lead capture from the marketing landing (any origin —
  // it only accepts an email; no self-serve signup in V1, §11).
  app.use(
    "/leads",
    cors({ origin: "*", allowMethods: ["POST", "OPTIONS"], allowHeaders: ["content-type"] }),
  );
  // The SDK runs inside the host app (a different origin from the API), so
  // browser fetches to the capability-token endpoints are cross-origin and
  // need CORS. The capability token is the auth boundary; ingest/submit also
  // enforce the strict per-panel Origin allowlist server-side (requireOpenPanel).
  app.use(
    "/panels/*",
    cors({
      origin: (o) => o ?? "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["content-type"],
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

  // Public media (unguessable keys are the access control, §14). Stable URLs
  // so links embedded in exported tickets never rot.
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
      template: b.template ?? DEFAULT_TEMPLATE,
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
    await repo.appendAudit({
      kind: "panel.created",
      actor: c.get("session").sub,
      summary: `Nowy panel (${b.audience}) dla „${project.name}”`,
      severity: "ok",
      projectId: project.id,
    });
    const sep = b.environmentUrl.includes("?") ? "&" : "?";
    return c.json(
      { id: panel.id, secretToken, panelUrl: `${b.environmentUrl}${sep}speqify=${secretToken}` },
      201,
    );
  });

  admin.post("/panels/:panelId/status", validateJson(panelStatusSchema), async (c) => {
    const panel = await repo.getPanelById(c.req.param("panelId"));
    if (!panel) throw new ApiException("not_found", "Panel not found");
    const { status } = body<z.infer<typeof panelStatusSchema>>(c);
    const updated = await repo.updatePanelStatus(panel.id, status);
    if (!updated) throw new ApiException("not_found", "Panel not found");
    return c.json({ id: updated.id, status: updated.status });
  });

  admin.delete("/panels/:panelId", async (c) => {
    const ok = await repo.deletePanel(c.req.param("panelId"));
    if (!ok) throw new ApiException("not_found", "Panel not found");
    await repo.appendAudit({
      kind: "panel.deleted",
      actor: c.get("session").sub,
      summary: `Usunięto panel ${c.req.param("panelId")} (link odwołany)`,
      severity: "warn",
      projectId: null,
    });
    return c.json({ deleted: true });
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
    // Key is envelope-encrypted at rest; only a 4-char hint is ever echoed (§9).
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

  // Manual trigger now; a Cloudflare Queue consumer + Cron drives this in
  // production (needs Workers Paid — operational prerequisite, §6).
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

  po.put("/annotations/:id/transcript", validateJson(transcriptEditSchema), async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const ann = await repo.getAnnotationById(c.req.param("id"));
    if (!ann) throw new ApiException("not_found", "Annotation not found");
    const panel = await repo.getPanelById(ann.panelId);
    if (!panel || panel.projectId !== project.id) {
      throw new ApiException("forbidden", "Not your annotation");
    }
    const b = body<z.infer<typeof transcriptEditSchema>>(c);
    await repo.setTranscription(ann.id, b.transcript, "done");
    return c.json({ ok: true });
  });

  // AI analysis — single in-flight per project; manual trigger now, a
  // Workflow drives it in production (Workers Paid, §14).
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

  /** Resolve a task that belongs to the requesting PO's project (else 404). */
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

  // Regenerate = scoped re-analysis of just this task's source annotations.
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

  // Phase 9: self-contained JSON/CSV export of accepted tasks. Idempotent —
  // accepted -> exported with a stable externalId; re-running never duplicates
  // and re-includes already-exported tasks (full snapshot). Jira/GitHub live
  // push still needs PO creds (later Phase 9).
  po.post("/tasks/export", async (c) => {
    const project = await resolvePoProject(c);
    if (!project) throw new ApiException("not_found", "No project for this account");
    const format = c.req.query("format") === "csv" ? "csv" : "json";
    const all = await repo.listTasks(project.id);
    const exportable = all.filter(
      (t) => t.status === "accepted" || t.status === "exported",
    );
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

  // --- Panel (capability-token) ---
  const panel = new Hono<AppEnv>();
  panel.use("/:token", withPanel(repo));
  panel.use("/:token/*", withPanel(repo));

  panel.get("/:token", async (c) => {
    const p = c.get("panel");
    const project = await repo.getProject(p.projectId);
    return c.json({
      panelId: p.id,
      audience: p.audience,
      status: p.status,
      environmentUrl: p.environmentUrl,
      projectName: project?.name ?? null,
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
    // Near-real-time transcription: poke the queue. `runOnce` is an idempotent
    // sweep backstop, so a missing queue (tests/local) or send failure is
    // non-fatal — never block the reviewer's submit on it.
    const queue = c.env?.TRANSCRIPTION_QUEUE;
    if (queue) {
      const msg: TranscriptionMessage = {
        kind: "transcribe",
        panelId: p.id,
        submissionId: input.submissionId,
      };
      try {
        c.executionCtx.waitUntil(queue.send(msg).catch(() => {}));
      } catch {
        /* no execution context (unit tests) — sweep/consumer still covers it */
      }
    }
    return c.json({ complete: true });
  });

  // Media upload: raw body, ?kind=, size-capped. Returns a MediaRef the SDK
  // then attaches to the annotation. Public URL is stable for ticket links.
  panel.post("/:token/uploads", requireOpenPanel, async (c) => {
    const p = c.get("panel");
    const kind = c.req.query("kind") ?? "";
    const limit = MEDIA_LIMITS[kind];
    if (limit === undefined) throw new ApiException("bad_request", "Unknown media kind");
    const buf = await c.req.arrayBuffer();
    if (buf.byteLength === 0) throw new ApiException("bad_request", "Empty upload");
    if (buf.byteLength > limit) throw new ApiException("bad_request", "Media too large");
    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    const bucketKey = `panels/${p.id}/${kind}/${newId()}`;
    await mediaStore.put(bucketKey, buf, contentType);
    const publicUrl = new URL(`/media/${bucketKey}`, c.req.url).href;
    return c.json({ bucketKey, contentType, bytes: buf.byteLength, publicUrl }, 201);
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
