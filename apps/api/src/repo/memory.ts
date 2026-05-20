import type {
  AdminStats,
  AnalysisRun,
  Annotation,
  AuditEntry,
  ExportConfig,
  ExportTarget,
  Lead,
  PlatformProviderConfig,
  PlatformProviderConfigView,
  Project,
  ProjectStatus,
  ProjectTemplates,
  Reviewer,
  ReviewSession,
  ReviewSessionStatus,
  Submission,
  Task,
  TranscriptionStatus,
  User,
  UserRole,
} from "@speqify/shared";
import { newId } from "../lib/ids.js";
import type {
  AddReviewerArgs,
  AnnotationCreate,
  CreateReviewSessionArgs,
  Repository,
  ReviewSessionPatch,
  TaskDraftInput,
  TaskMutation,
  TaskPatch,
  UserWithSecret,
} from "./types.js";

/**
 * In-memory Repository — used by unit tests and local dev without D1.
 * Behaviour is the contract the D1 adapter must match.
 */
export class InMemoryRepository implements Repository {
  private reviewSessions = new Map<string, ReviewSession>();
  private reviewers = new Map<string, Reviewer>();
  // submissions keyed by `${sessionId}:${submissionId}` — the same submission
  // batch is never shared across sessions, so this is the natural composite.
  private submissions = new Map<string, Submission>();
  // annotations keyed by `${sessionId}:${reviewerId}:${clientAnnotationId}` —
  // the idempotency unique-index (§14).
  private annotations = new Map<string, Annotation>();
  private users = new Map<string, UserWithSecret>();
  private projects = new Map<string, Project>();
  private exportConfigs = new Map<string, ExportConfig>();
  private runs = new Map<string, AnalysisRun>();
  private tasks = new Map<string, Task>();
  private audit: AuditEntry[] = [];
  private platform: PlatformProviderConfigView | null = null;
  private platformKeyRef: string | null = null;
  private leads: Lead[] = [];

  constructor(seed?: {
    reviewSessions?: ReviewSession[];
    reviewers?: Reviewer[];
    users?: UserWithSecret[];
    projects?: Project[];
    annotations?: Annotation[];
    tasks?: Task[];
  }) {
    for (const s of seed?.reviewSessions ?? []) this.reviewSessions.set(s.id, s);
    for (const r of seed?.reviewers ?? []) this.reviewers.set(r.id, r);
    for (const u of seed?.users ?? []) this.users.set(u.email.toLowerCase(), u);
    for (const p of seed?.projects ?? []) this.projects.set(p.id, p);
    // Seeded review data uses the annotation/task id as the map key (no
    // idempotency key needed — these never arrive via the ingest path).
    for (const a of seed?.annotations ?? []) this.annotations.set(a.id, a);
    for (const t of seed?.tasks ?? []) this.tasks.set(t.id, t);
  }

  async getOrCreateSubmission(args: {
    sessionId: string;
    reviewerId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission> {
    const key = `${args.sessionId}:${args.submissionId}`;
    const existing = this.submissions.get(key);
    if (existing) return existing;
    const created: Submission = {
      id: args.submissionId,
      sessionId: args.sessionId,
      reviewerId: args.reviewerId,
      clientId: args.clientId,
      complete: false,
      createdAt: new Date().toISOString(),
    };
    this.submissions.set(key, created);
    return created;
  }

  async upsertAnnotation(
    args: AnnotationCreate,
  ): Promise<{ annotation: Annotation; created: boolean }> {
    const { input } = args;
    const idemKey = `${args.sessionId}:${args.reviewerId}:${input.clientAnnotationId}`;
    const existing = this.annotations.get(idemKey);
    if (existing) return { annotation: existing, created: false };

    const annotation: Annotation = {
      id: newId(),
      sessionId: args.sessionId,
      reviewerId: args.reviewerId,
      submissionId: input.submissionId,
      type: input.type,
      status: "draft",
      pageUrl: input.pageUrl,
      breadcrumb: input.breadcrumb,
      element: input.element,
      screenshot: input.screenshot,
      voice: input.voice,
      recordingVideo: input.recordingVideo,
      recordingAudio: input.recordingAudio,
      transcript: null,
      transcriptionStatus: null,
      textNote: input.textNote,
      tags: input.tags ?? [],
      structured: input.structured,
      technical: input.technical,
      hostApp: input.hostApp,
      clientCreatedAt: input.clientCreatedAt,
      serverCreatedAt: new Date().toISOString(),
      correlationId: args.correlationId,
    };
    this.annotations.set(idemKey, annotation);
    return { annotation, created: true };
  }

  async completeSubmission(args: { sessionId: string; submissionId: string }): Promise<boolean> {
    const key = `${args.sessionId}:${args.submissionId}`;
    const submission = this.submissions.get(key);
    if (!submission) return false;
    submission.complete = true;
    for (const a of this.annotations.values()) {
      if (a.submissionId === args.submissionId && a.status === "draft") {
        a.status = "submitted";
      }
    }
    return true;
  }

  async getUserByEmail(email: string): Promise<UserWithSecret | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async listTranscribable(limit: number): Promise<Annotation[]> {
    const pending = new Set(["queued", "failed"]);
    return [...this.annotations.values()]
      .filter(
        (a) =>
          a.status === "submitted" &&
          (a.voice !== null || a.recordingAudio !== null) &&
          (a.transcriptionStatus === null || pending.has(a.transcriptionStatus)),
      )
      .slice(0, limit);
  }

  async getAnnotationById(id: string): Promise<Annotation | null> {
    return [...this.annotations.values()].find((a) => a.id === id) ?? null;
  }

  async setTranscription(
    id: string,
    transcript: string | null,
    status: TranscriptionStatus,
  ): Promise<Annotation | null> {
    const a = [...this.annotations.values()].find((x) => x.id === id);
    if (!a) return null;
    a.transcript = transcript;
    a.transcriptionStatus = status;
    return a;
  }

  async createUser(args: {
    role: UserRole;
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const key = args.email.toLowerCase();
    if (this.users.has(key)) throw new Error("email already exists");
    const user: UserWithSecret = {
      id: newId(),
      role: args.role,
      email: args.email,
      displayName: args.displayName,
      passwordHash: args.passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.users.set(key, user);
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async listUsers(): Promise<User[]> {
    return [...this.users.values()].map(({ passwordHash: _ph, ...u }) => u);
  }

  async listProjects(): Promise<Project[]> {
    return [...this.projects.values()];
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async createProject(args: {
    name: string;
    productOwnerId: string;
    environmentUrls: string[];
    templates: ProjectTemplates;
  }): Promise<Project> {
    const project: Project = {
      id: newId(),
      name: args.name,
      productOwnerId: args.productOwnerId,
      environmentUrls: args.environmentUrls,
      status: "live",
      templates: args.templates,
      exportConfigId: null,
      createdAt: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  async setProjectStatus(projectId: string, status: ProjectStatus): Promise<Project | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;
    project.status = status;
    return project;
  }

  async appendAudit(entry: {
    kind: string;
    actor: string;
    summary: string;
    severity: "ok" | "warn" | "danger";
    projectId: string | null;
  }): Promise<void> {
    this.audit.push({ id: newId(), at: new Date().toISOString(), ...entry });
  }

  async listAudit(limit: number): Promise<AuditEntry[]> {
    return [...this.audit].reverse().slice(0, limit);
  }

  async getAdminStats(): Promise<AdminStats> {
    const tasks = [...this.tasks.values()];
    const accepted = tasks.filter((t) => t.status === "accepted").length;
    const rejected = tasks.filter((t) => t.status === "rejected").length;
    const exported = tasks.filter((t) => t.status === "exported").length;
    const reviewed = accepted + rejected;
    const anns = [...this.annotations.values()];
    return {
      projects: this.projects.size,
      productOwners: [...this.users.values()].filter((u) => u.role === "product_owner").length,
      annotations: anns.length,
      submitted: anns.filter((a) => a.status === "submitted").length,
      tasks: tasks.length,
      accepted,
      rejected,
      exported,
      acceptRate: reviewed === 0 ? null : accepted / reviewed,
    };
  }

  async addLead(email: string, locale: "pl" | "en" | null): Promise<Lead> {
    const lead: Lead = { id: newId(), email, locale, at: new Date().toISOString() };
    this.leads.push(lead);
    return lead;
  }

  async listLeads(limit: number): Promise<Lead[]> {
    return [...this.leads].reverse().slice(0, limit);
  }

  async getPlatformConfig(): Promise<PlatformProviderConfigView | null> {
    return this.platform;
  }

  async getPlatformConfigInternal(): Promise<{
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
  } | null> {
    if (!this.platform) return null;
    const { aiKeyConfigured: _ac, aiKeyHint: _ah, ...config } = this.platform;
    return { config, aiKeyRef: this.platformKeyRef };
  }

  async setPlatformConfig(args: {
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
    aiKeyHint: string | null;
  }): Promise<PlatformProviderConfigView> {
    // Keep an existing key if the caller did not supply a new one.
    const keepRef = args.aiKeyRef === null && this.platform?.aiKeyConfigured;
    const view: PlatformProviderConfigView = {
      ...args.config,
      aiKeyConfigured: keepRef ? true : args.aiKeyRef !== null,
      aiKeyHint: args.aiKeyRef === null ? (this.platform?.aiKeyHint ?? null) : args.aiKeyHint,
    };
    this.platform = view;
    if (!keepRef) this.platformKeyRef = args.aiKeyRef;
    return view;
  }

  // --- Review sessions (RS-3) ---

  async createReviewSession(args: CreateReviewSessionArgs): Promise<ReviewSession> {
    const session: ReviewSession = {
      id: newId(),
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      instructions: args.instructions,
      envUrl: args.envUrl,
      token: args.token,
      status: "draft",
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      createdBy: args.createdBy,
      createdAt: new Date().toISOString(),
    };
    this.reviewSessions.set(session.id, session);
    return session;
  }

  async getReviewSession(id: string): Promise<ReviewSession | null> {
    return this.reviewSessions.get(id) ?? null;
  }

  async getReviewSessionByToken(token: string): Promise<ReviewSession | null> {
    return [...this.reviewSessions.values()].find((s) => s.token === token) ?? null;
  }

  async listReviewSessionsByProject(projectId: string): Promise<ReviewSession[]> {
    return [...this.reviewSessions.values()].filter((s) => s.projectId === projectId);
  }

  async updateReviewSession(id: string, patch: ReviewSessionPatch): Promise<ReviewSession | null> {
    const existing = this.reviewSessions.get(id);
    if (!existing) return null;
    const next: ReviewSession = { ...existing, ...patch };
    this.reviewSessions.set(id, next);
    return next;
  }

  async setReviewSessionStatus(
    id: string,
    status: ReviewSessionStatus,
  ): Promise<ReviewSession | null> {
    const existing = this.reviewSessions.get(id);
    if (!existing) return null;
    existing.status = status;
    return existing;
  }

  // --- Reviewers (RS-3) ---

  async addReviewer(args: AddReviewerArgs): Promise<Reviewer> {
    const now = new Date().toISOString();
    const reviewer: Reviewer = {
      id: newId(),
      sessionId: args.sessionId,
      name: args.name,
      email: args.email,
      token: args.token,
      status: "pending",
      invitedAt: now,
      acceptedAt: null,
      lastSeenAt: null,
    };
    this.reviewers.set(reviewer.id, reviewer);
    return reviewer;
  }

  async getReviewer(id: string): Promise<Reviewer | null> {
    return this.reviewers.get(id) ?? null;
  }

  async getReviewerByToken(token: string): Promise<Reviewer | null> {
    return [...this.reviewers.values()].find((r) => r.token === token) ?? null;
  }

  async listReviewersBySession(sessionId: string): Promise<Reviewer[]> {
    return [...this.reviewers.values()].filter((r) => r.sessionId === sessionId);
  }

  async revokeReviewer(id: string): Promise<Reviewer | null> {
    const r = this.reviewers.get(id);
    if (!r) return null;
    r.status = "declined";
    return r;
  }

  async markReviewerAccepted(id: string): Promise<Reviewer | null> {
    const r = this.reviewers.get(id);
    if (!r) return null;
    if (r.status === "pending") {
      r.status = "active";
      r.acceptedAt = new Date().toISOString();
    }
    return r;
  }

  async markReviewerSeen(id: string, at: string): Promise<void> {
    const r = this.reviewers.get(id);
    if (!r) return;
    r.lastSeenAt = at;
  }

  async getProjectByOwner(ownerId: string): Promise<Project | null> {
    return [...this.projects.values()].find((p) => p.productOwnerId === ownerId) ?? null;
  }

  async updateProjectTemplates(
    projectId: string,
    templates: ProjectTemplates,
  ): Promise<Project | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;
    project.templates = templates;
    return project;
  }

  async getExportConfig(projectId: string): Promise<ExportConfig | null> {
    return this.exportConfigs.get(projectId) ?? null;
  }

  async upsertExportConfig(args: {
    projectId: string;
    target: ExportTarget;
    encryptedCredentialsRef: string | null;
    fieldMapping: Record<string, string>;
    defaults: Record<string, string>;
  }): Promise<ExportConfig> {
    const existing = this.exportConfigs.get(args.projectId);
    const cfg: ExportConfig = {
      id: existing?.id ?? newId(),
      projectId: args.projectId,
      target: args.target,
      encryptedCredentialsRef: args.encryptedCredentialsRef,
      fieldMapping: args.fieldMapping,
      defaults: args.defaults,
    };
    this.exportConfigs.set(args.projectId, cfg);
    const project = this.projects.get(args.projectId);
    if (project) project.exportConfigId = cfg.id;
    return cfg;
  }

  async startAnalysisRun(projectId: string): Promise<AnalysisRun | null> {
    const busy = [...this.runs.values()].some(
      (r) => r.projectId === projectId && r.status === "running",
    );
    if (busy) return null;
    const run: AnalysisRun = {
      id: newId(),
      projectId,
      status: "running",
      annotationIds: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    };
    this.runs.set(run.id, run);
    return run;
  }

  async finishAnalysisRun(
    runId: string,
    status: "succeeded" | "failed",
    annotationIds: string[],
    error: string | null,
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    run.status = status;
    run.annotationIds = annotationIds;
    run.error = error;
    run.finishedAt = new Date().toISOString();
  }

  async listSubmittedForProject(projectId: string): Promise<Annotation[]> {
    const sessionIds = new Set(
      [...this.reviewSessions.values()].filter((s) => s.projectId === projectId).map((s) => s.id),
    );
    if (sessionIds.size === 0) return [];
    return [...this.annotations.values()].filter(
      (a) => a.status === "submitted" && sessionIds.has(a.sessionId),
    );
  }

  async createTasks(drafts: TaskDraftInput[]): Promise<Task[]> {
    const created: Task[] = [];
    for (const d of drafts) {
      const task: Task = {
        id: newId(),
        projectId: d.projectId,
        status: "generated",
        parentTaskId: d.parentTaskId,
        title: d.title,
        description: d.description,
        acceptanceCriteria: d.acceptanceCriteria,
        labels: d.labels,
        component: d.component,
        version: d.version,
        priority: d.priority,
        confidence: d.confidence,
        subtaskType: d.subtaskType,
        annotationIds: d.annotationIds,
        screenshotKeys: d.screenshotKeys,
        externalId: null,
        exportError: null,
        reviewedAt: null,
        rev: 1,
        createdAt: new Date().toISOString(),
      };
      this.tasks.set(task.id, task);
      created.push(task);
    }
    return created;
  }

  async markAnnotationsProcessed(ids: string[]): Promise<void> {
    const set = new Set(ids);
    for (const a of this.annotations.values()) {
      if (set.has(a.id) && (a.status === "submitted" || a.status === "draft")) {
        a.status = "processed";
      }
    }
  }

  async listTasks(projectId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((t) => t.projectId === projectId);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async getAnnotationsByIds(ids: string[]): Promise<Annotation[]> {
    const want = new Set(ids);
    return [...this.annotations.values()].filter((a) => want.has(a.id));
  }

  async updateTask(id: string, expectedRev: number, patch: TaskPatch): Promise<TaskMutation> {
    const task = this.tasks.get(id);
    if (!task) return { ok: false, reason: "not_found" };
    if (task.rev !== expectedRev) return { ok: false, reason: "conflict" };
    const next: Task = { ...task, ...patch, rev: task.rev + 1 };
    this.tasks.set(id, next);
    return { ok: true, task: next };
  }
}
