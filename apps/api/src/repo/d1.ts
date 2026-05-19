import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@speqify/db/schema";
import type {
  AnalysisRun,
  Annotation,
  AnnotationStatus,
  AnnotationType,
  Task,
  TaskStatus,
  ExportConfig,
  ExportTarget,
  Project,
  ProjectTemplates,
  Reviewer,
  ReviewerStatus,
  ReviewSession,
  ReviewSessionStatus,
  Submission,
  TranscriptionStatus,
  User,
  UserRole,
} from "@speqify/shared";
import type {
  AdminStats,
  AuditEntry,
  Lead,
  PlatformProviderConfig,
  PlatformProviderConfigView,
  ProjectStatus,
  SubtaskType,
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

type Db = DrizzleD1Database<typeof schema>;
type SubmissionRow = typeof schema.submissions.$inferSelect;
type AnnotationRow = typeof schema.annotations.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;
type ReviewSessionRow = typeof schema.reviewSessions.$inferSelect;
type ReviewerRow = typeof schema.reviewers.$inferSelect;

type ExportConfigRow = typeof schema.exportConfigs.$inferSelect;
type AnalysisRunRow = typeof schema.analysisRuns.$inferSelect;
type TaskRow = typeof schema.tasks.$inferSelect;

function toAnalysisRun(r: AnalysisRunRow): AnalysisRun {
  return {
    id: r.id,
    projectId: r.projectId,
    status: r.status as AnalysisRun["status"],
    annotationIds: r.annotationIds,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    error: r.error ?? null,
  };
}

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    projectId: r.projectId,
    status: r.status as TaskStatus,
    parentTaskId: r.parentTaskId ?? null,
    title: r.title,
    description: r.description,
    acceptanceCriteria: r.acceptanceCriteria,
    labels: r.labels,
    component: r.component ?? null,
    version: r.version ?? null,
    priority: (r.priority as Task["priority"]) ?? null,
    confidence: r.confidence ?? null,
    subtaskType: (r.subtaskType as SubtaskType | null) ?? null,
    annotationIds: r.annotationIds,
    screenshotKeys: r.screenshotKeys,
    externalId: r.externalId ?? null,
    exportError: r.exportError ?? null,
    reviewedAt: r.reviewedAt ?? null,
    rev: r.rev ?? 1,
    createdAt: r.createdAt,
  };
}

function toExportConfig(r: ExportConfigRow): ExportConfig {
  return {
    id: r.id,
    projectId: r.projectId,
    target: r.target as ExportTarget,
    encryptedCredentialsRef: r.encryptedCredentialsRef ?? null,
    fieldMapping: r.fieldMapping,
    defaults: r.defaults,
  };
}

function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    productOwnerId: r.productOwnerId,
    environmentUrls: r.environmentUrls,
    status: (r.status as ProjectStatus) ?? "live",
    templates: r.templates,
    exportConfigId: r.exportConfigId ?? null,
    createdAt: r.createdAt,
  };
}

function toReviewSession(r: ReviewSessionRow): ReviewSession {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    envUrl: r.envUrl,
    token: r.token,
    status: r.status as ReviewSessionStatus,
    startsAt: r.startsAt ?? null,
    endsAt: r.endsAt ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

function toReviewer(r: ReviewerRow): Reviewer {
  return {
    id: r.id,
    sessionId: r.sessionId,
    name: r.name,
    email: r.email,
    token: r.token,
    status: r.status as ReviewerStatus,
    invitedAt: r.invitedAt,
    acceptedAt: r.acceptedAt ?? null,
    lastSeenAt: r.lastSeenAt ?? null,
  };
}

function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    sessionId: r.sessionId,
    reviewerId: r.reviewerId,
    clientId: r.clientId,
    complete: r.complete,
    createdAt: r.createdAt,
  };
}

function toAnnotation(r: AnnotationRow): Annotation {
  return {
    id: r.id,
    sessionId: r.sessionId,
    reviewerId: r.reviewerId,
    submissionId: r.submissionId,
    type: r.type as AnnotationType,
    status: r.status as AnnotationStatus,
    pageUrl: r.pageUrl,
    breadcrumb: r.breadcrumb ?? [],
    element: r.element ?? null,
    screenshot: r.screenshot ?? null,
    voice: r.voice ?? null,
    recordingVideo: r.recordingVideo ?? null,
    recordingAudio: r.recordingAudio ?? null,
    transcript: r.transcript ?? null,
    transcriptionStatus: r.transcriptionStatus
      ? (r.transcriptionStatus as Annotation["transcriptionStatus"])
      : null,
    textNote: r.textNote ?? null,
    tags: r.tags ?? [],
    structured: r.structured ?? null,
    technical: r.technical ?? null,
    hostApp: r.hostApp ?? null,
    clientCreatedAt: r.clientCreatedAt,
    serverCreatedAt: r.serverCreatedAt,
    correlationId: r.correlationId,
  };
}

/**
 * D1/Drizzle Repository — the runtime adapter. Behaviour mirrors
 * InMemoryRepository (the contract tests pin).
 */
export class D1Repository implements Repository {
  private readonly db: Db;
  constructor(d1: D1Database) {
    this.db = drizzle(d1, { schema });
  }

  async getOrCreateSubmission(args: {
    sessionId: string;
    reviewerId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission> {
    const existing = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.id, args.submissionId),
          eq(schema.submissions.sessionId, args.sessionId),
        ),
      )
      .limit(1);
    if (existing[0]) return toSubmission(existing[0]);

    const inserted = await this.db
      .insert(schema.submissions)
      .values({
        id: args.submissionId,
        sessionId: args.sessionId,
        reviewerId: args.reviewerId,
        clientId: args.clientId,
        complete: false,
      })
      .returning();
    return toSubmission(inserted[0] as SubmissionRow);
  }

  async upsertAnnotation(
    args: AnnotationCreate,
  ): Promise<{ annotation: Annotation; created: boolean }> {
    const { input } = args;
    const existing = await this.db
      .select()
      .from(schema.annotations)
      .where(
        and(
          eq(schema.annotations.sessionId, args.sessionId),
          eq(schema.annotations.reviewerId, args.reviewerId),
          eq(schema.annotations.clientAnnotationId, input.clientAnnotationId),
        ),
      )
      .limit(1);
    if (existing[0]) return { annotation: toAnnotation(existing[0]), created: false };

    const inserted = await this.db
      .insert(schema.annotations)
      .values({
        id: newId(),
        sessionId: args.sessionId,
        reviewerId: args.reviewerId,
        submissionId: input.submissionId,
        clientAnnotationId: input.clientAnnotationId,
        type: input.type,
        status: "draft",
        pageUrl: input.pageUrl,
        breadcrumb: input.breadcrumb,
        element: input.element,
        screenshot: input.screenshot,
        voice: input.voice,
        recordingVideo: input.recordingVideo,
        recordingAudio: input.recordingAudio,
        textNote: input.textNote,
        tags: input.tags ?? [],
        structured: input.structured,
        technical: input.technical,
        hostApp: input.hostApp,
        clientCreatedAt: input.clientCreatedAt,
        correlationId: args.correlationId,
      })
      .returning();
    return { annotation: toAnnotation(inserted[0] as AnnotationRow), created: true };
  }

  async completeSubmission(args: { sessionId: string; submissionId: string }): Promise<boolean> {
    const updated = await this.db
      .update(schema.submissions)
      .set({ complete: true })
      .where(
        and(
          eq(schema.submissions.id, args.submissionId),
          eq(schema.submissions.sessionId, args.sessionId),
        ),
      )
      .returning();
    if (!updated[0]) return false;

    await this.db
      .update(schema.annotations)
      .set({ status: "submitted" })
      .where(
        and(
          eq(schema.annotations.submissionId, args.submissionId),
          eq(schema.annotations.status, "draft"),
        ),
      );
    return true;
  }

  async getUserByEmail(email: string): Promise<UserWithSecret | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    const r: UserRow | undefined = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      role: r.role as UserRole,
      email: r.email,
      displayName: r.displayName,
      passwordHash: r.passwordHash ?? null,
      createdAt: r.createdAt,
    };
  }

  async listTranscribable(limit: number): Promise<Annotation[]> {
    const rows = await this.db
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.status, "submitted"))
      .limit(Math.max(limit * 4, limit));
    const pending = new Set(["queued", "failed"]);
    return rows
      .map(toAnnotation)
      .filter(
        (a) =>
          (a.voice !== null || a.recordingAudio !== null) &&
          (a.transcriptionStatus === null || pending.has(a.transcriptionStatus)),
      )
      .slice(0, limit);
  }

  async getAnnotationById(id: string): Promise<Annotation | null> {
    const rows = await this.db
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.id, id))
      .limit(1);
    return rows[0] ? toAnnotation(rows[0]) : null;
  }

  async setTranscription(
    id: string,
    transcript: string | null,
    status: TranscriptionStatus,
  ): Promise<Annotation | null> {
    const updated = await this.db
      .update(schema.annotations)
      .set({ transcript, transcriptionStatus: status })
      .where(eq(schema.annotations.id, id))
      .returning();
    return updated[0] ? toAnnotation(updated[0]) : null;
  }

  async createUser(args: {
    role: UserRole;
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const inserted = await this.db
      .insert(schema.users)
      .values({
        id: newId(),
        role: args.role,
        email: args.email,
        displayName: args.displayName,
        passwordHash: args.passwordHash,
      })
      .returning();
    const r = inserted[0] as UserRow;
    return {
      id: r.id,
      role: r.role as UserRole,
      email: r.email,
      displayName: r.displayName,
      createdAt: r.createdAt,
    };
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.select().from(schema.users);
    return rows.map((r) => ({
      id: r.id,
      role: r.role as UserRole,
      email: r.email,
      displayName: r.displayName,
      createdAt: r.createdAt,
    }));
  }

  async listProjects(): Promise<Project[]> {
    const rows = await this.db.select().from(schema.projects);
    return rows.map(toProject);
  }

  async getProject(id: string): Promise<Project | null> {
    const rows = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);
    return rows[0] ? toProject(rows[0]) : null;
  }

  async createProject(args: {
    name: string;
    productOwnerId: string;
    environmentUrls: string[];
    templates: ProjectTemplates;
  }): Promise<Project> {
    const inserted = await this.db
      .insert(schema.projects)
      .values({
        id: newId(),
        name: args.name,
        productOwnerId: args.productOwnerId,
        environmentUrls: args.environmentUrls,
        templates: args.templates,
      })
      .returning();
    return toProject(inserted[0] as ProjectRow);
  }

  // --- Review sessions (RS-3) ---

  async createReviewSession(args: CreateReviewSessionArgs): Promise<ReviewSession> {
    const inserted = await this.db
      .insert(schema.reviewSessions)
      .values({
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
      })
      .returning();
    return toReviewSession(inserted[0] as ReviewSessionRow);
  }

  async getReviewSession(id: string): Promise<ReviewSession | null> {
    const rows = await this.db
      .select()
      .from(schema.reviewSessions)
      .where(eq(schema.reviewSessions.id, id))
      .limit(1);
    return rows[0] ? toReviewSession(rows[0]) : null;
  }

  async getReviewSessionByToken(token: string): Promise<ReviewSession | null> {
    const rows = await this.db
      .select()
      .from(schema.reviewSessions)
      .where(eq(schema.reviewSessions.token, token))
      .limit(1);
    return rows[0] ? toReviewSession(rows[0]) : null;
  }

  async listReviewSessionsByProject(projectId: string): Promise<ReviewSession[]> {
    const rows = await this.db
      .select()
      .from(schema.reviewSessions)
      .where(eq(schema.reviewSessions.projectId, projectId))
      .orderBy(desc(schema.reviewSessions.createdAt));
    return rows.map(toReviewSession);
  }

  async updateReviewSession(
    id: string,
    patch: ReviewSessionPatch,
  ): Promise<ReviewSession | null> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set["name"] = patch.name;
    if (patch.description !== undefined) set["description"] = patch.description;
    if (patch.instructions !== undefined) set["instructions"] = patch.instructions;
    if (patch.envUrl !== undefined) set["envUrl"] = patch.envUrl;
    if (patch.startsAt !== undefined) set["startsAt"] = patch.startsAt;
    if (patch.endsAt !== undefined) set["endsAt"] = patch.endsAt;
    if (Object.keys(set).length === 0) return this.getReviewSession(id);
    const updated = await this.db
      .update(schema.reviewSessions)
      .set(set)
      .where(eq(schema.reviewSessions.id, id))
      .returning();
    return updated[0] ? toReviewSession(updated[0]) : null;
  }

  async setReviewSessionStatus(
    id: string,
    status: ReviewSessionStatus,
  ): Promise<ReviewSession | null> {
    const updated = await this.db
      .update(schema.reviewSessions)
      .set({ status })
      .where(eq(schema.reviewSessions.id, id))
      .returning();
    return updated[0] ? toReviewSession(updated[0]) : null;
  }

  // --- Reviewers (RS-3) ---

  async addReviewer(args: AddReviewerArgs): Promise<Reviewer> {
    const inserted = await this.db
      .insert(schema.reviewers)
      .values({
        id: newId(),
        sessionId: args.sessionId,
        name: args.name,
        email: args.email,
        token: args.token,
        status: "pending",
      })
      .returning();
    return toReviewer(inserted[0] as ReviewerRow);
  }

  async getReviewer(id: string): Promise<Reviewer | null> {
    const rows = await this.db
      .select()
      .from(schema.reviewers)
      .where(eq(schema.reviewers.id, id))
      .limit(1);
    return rows[0] ? toReviewer(rows[0]) : null;
  }

  async getReviewerByToken(token: string): Promise<Reviewer | null> {
    const rows = await this.db
      .select()
      .from(schema.reviewers)
      .where(eq(schema.reviewers.token, token))
      .limit(1);
    return rows[0] ? toReviewer(rows[0]) : null;
  }

  async listReviewersBySession(sessionId: string): Promise<Reviewer[]> {
    const rows = await this.db
      .select()
      .from(schema.reviewers)
      .where(eq(schema.reviewers.sessionId, sessionId))
      .orderBy(desc(schema.reviewers.invitedAt));
    return rows.map(toReviewer);
  }

  async revokeReviewer(id: string): Promise<Reviewer | null> {
    const updated = await this.db
      .update(schema.reviewers)
      .set({ status: "declined" })
      .where(eq(schema.reviewers.id, id))
      .returning();
    return updated[0] ? toReviewer(updated[0]) : null;
  }

  async markReviewerAccepted(id: string): Promise<Reviewer | null> {
    // Idempotent: only the pending → active transition stamps acceptedAt;
    // a subsequent call on an already-active row is a no-op.
    const updated = await this.db
      .update(schema.reviewers)
      .set({ status: "active", acceptedAt: new Date().toISOString() })
      .where(and(eq(schema.reviewers.id, id), eq(schema.reviewers.status, "pending")))
      .returning();
    if (updated[0]) return toReviewer(updated[0]);
    return this.getReviewer(id);
  }

  async markReviewerSeen(id: string, at: string): Promise<void> {
    await this.db
      .update(schema.reviewers)
      .set({ lastSeenAt: at })
      .where(eq(schema.reviewers.id, id));
  }

  async getProjectByOwner(ownerId: string): Promise<Project | null> {
    const rows = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.productOwnerId, ownerId))
      .limit(1);
    return rows[0] ? toProject(rows[0]) : null;
  }

  async updateProjectTemplates(
    projectId: string,
    templates: ProjectTemplates,
  ): Promise<Project | null> {
    const updated = await this.db
      .update(schema.projects)
      .set({ templates })
      .where(eq(schema.projects.id, projectId))
      .returning();
    return updated[0] ? toProject(updated[0]) : null;
  }

  async getExportConfig(projectId: string): Promise<ExportConfig | null> {
    const rows = await this.db
      .select()
      .from(schema.exportConfigs)
      .where(eq(schema.exportConfigs.projectId, projectId))
      .limit(1);
    return rows[0] ? toExportConfig(rows[0]) : null;
  }

  async upsertExportConfig(args: {
    projectId: string;
    target: ExportTarget;
    encryptedCredentialsRef: string | null;
    fieldMapping: Record<string, string>;
    defaults: Record<string, string>;
  }): Promise<ExportConfig> {
    const existing = await this.db
      .select()
      .from(schema.exportConfigs)
      .where(eq(schema.exportConfigs.projectId, args.projectId))
      .limit(1);

    let row: ExportConfigRow;
    if (existing[0]) {
      const updated = await this.db
        .update(schema.exportConfigs)
        .set({
          target: args.target,
          encryptedCredentialsRef: args.encryptedCredentialsRef,
          fieldMapping: args.fieldMapping,
          defaults: args.defaults,
        })
        .where(eq(schema.exportConfigs.id, existing[0].id))
        .returning();
      row = updated[0] as ExportConfigRow;
    } else {
      const inserted = await this.db
        .insert(schema.exportConfigs)
        .values({
          id: newId(),
          projectId: args.projectId,
          target: args.target,
          encryptedCredentialsRef: args.encryptedCredentialsRef,
          fieldMapping: args.fieldMapping,
          defaults: args.defaults,
        })
        .returning();
      row = inserted[0] as ExportConfigRow;
    }

    await this.db
      .update(schema.projects)
      .set({ exportConfigId: row.id })
      .where(eq(schema.projects.id, args.projectId));

    return toExportConfig(row);
  }

  async startAnalysisRun(projectId: string): Promise<AnalysisRun | null> {
    const running = await this.db
      .select()
      .from(schema.analysisRuns)
      .where(
        and(
          eq(schema.analysisRuns.projectId, projectId),
          eq(schema.analysisRuns.status, "running"),
        ),
      )
      .limit(1);
    if (running[0]) return null;
    const inserted = await this.db
      .insert(schema.analysisRuns)
      .values({ id: newId(), projectId, status: "running", annotationIds: [] })
      .returning();
    return toAnalysisRun(inserted[0] as AnalysisRunRow);
  }

  async finishAnalysisRun(
    runId: string,
    status: "succeeded" | "failed",
    annotationIds: string[],
    error: string | null,
  ): Promise<void> {
    await this.db
      .update(schema.analysisRuns)
      .set({ status, annotationIds, error, finishedAt: new Date().toISOString() })
      .where(eq(schema.analysisRuns.id, runId));
  }

  async listSubmittedForProject(projectId: string): Promise<Annotation[]> {
    const sessions = await this.db
      .select({ id: schema.reviewSessions.id })
      .from(schema.reviewSessions)
      .where(eq(schema.reviewSessions.projectId, projectId));
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(schema.annotations)
      .where(
        and(
          eq(schema.annotations.status, "submitted"),
          inArray(schema.annotations.sessionId, sessionIds),
        ),
      );
    return rows.map(toAnnotation);
  }

  async createTasks(drafts: TaskDraftInput[]): Promise<Task[]> {
    const out: Task[] = [];
    for (const d of drafts) {
      const inserted = await this.db
        .insert(schema.tasks)
        .values({
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
        })
        .returning();
      out.push(toTask(inserted[0] as TaskRow));
    }
    return out;
  }

  async markAnnotationsProcessed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(schema.annotations)
      .set({ status: "processed" })
      .where(
        and(
          inArray(schema.annotations.id, ids),
          inArray(schema.annotations.status, ["submitted", "draft"]),
        ),
      );
  }

  async listTasks(projectId: string): Promise<Task[]> {
    const rows = await this.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, projectId));
    return rows.map(toTask);
  }

  async getTask(id: string): Promise<Task | null> {
    const rows = await this.db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    return rows[0] ? toTask(rows[0]) : null;
  }

  async getAnnotationsByIds(ids: string[]): Promise<Annotation[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(schema.annotations)
      .where(inArray(schema.annotations.id, ids));
    return rows.map(toAnnotation);
  }

  async updateTask(id: string, expectedRev: number, patch: TaskPatch): Promise<TaskMutation> {
    // Optimistic write: the rev predicate makes the update a no-op under a
    // concurrent edit; a follow-up read disambiguates not-found vs conflict.
    const set: Record<string, unknown> = { rev: expectedRev + 1 };
    if (patch.title !== undefined) set["title"] = patch.title;
    if (patch.description !== undefined) set["description"] = patch.description;
    if (patch.acceptanceCriteria !== undefined)
      set["acceptanceCriteria"] = patch.acceptanceCriteria;
    if (patch.labels !== undefined) set["labels"] = patch.labels;
    if (patch.component !== undefined) set["component"] = patch.component;
    if (patch.version !== undefined) set["version"] = patch.version;
    if (patch.priority !== undefined) set["priority"] = patch.priority;
    if (patch.subtaskType !== undefined) set["subtaskType"] = patch.subtaskType;
    if (patch.confidence !== undefined) set["confidence"] = patch.confidence;
    if (patch.status !== undefined) set["status"] = patch.status;
    if (patch.reviewedAt !== undefined) set["reviewedAt"] = patch.reviewedAt;
    if (patch.externalId !== undefined) set["externalId"] = patch.externalId;
    if (patch.exportError !== undefined) set["exportError"] = patch.exportError;

    const updated = await this.db
      .update(schema.tasks)
      .set(set)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.rev, expectedRev)))
      .returning();
    if (updated[0]) return { ok: true, task: toTask(updated[0]) };
    const exists = await this.getTask(id);
    return { ok: false, reason: exists ? "conflict" : "not_found" };
  }

  async setProjectStatus(projectId: string, status: ProjectStatus): Promise<Project | null> {
    const updated = await this.db
      .update(schema.projects)
      .set({ status })
      .where(eq(schema.projects.id, projectId))
      .returning();
    return updated[0] ? toProject(updated[0]) : null;
  }

  async appendAudit(entry: {
    kind: string;
    actor: string;
    summary: string;
    severity: "ok" | "warn" | "danger";
    projectId: string | null;
  }): Promise<void> {
    await this.db.insert(schema.auditLog).values({ id: newId(), ...entry });
  }

  async listAudit(limit: number): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt,
      kind: r.kind,
      actor: r.actor,
      summary: r.summary,
      severity: r.severity as AuditEntry["severity"],
      projectId: r.projectId ?? null,
    }));
  }

  async getAdminStats(): Promise<AdminStats> {
    const [projects, users, anns, tasks] = await Promise.all([
      this.db.select({ id: schema.projects.id }).from(schema.projects),
      this.db.select({ role: schema.users.role }).from(schema.users),
      this.db.select({ status: schema.annotations.status }).from(schema.annotations),
      this.db.select({ status: schema.tasks.status }).from(schema.tasks),
    ]);
    const accepted = tasks.filter((t) => t.status === "accepted").length;
    const rejected = tasks.filter((t) => t.status === "rejected").length;
    const exported = tasks.filter((t) => t.status === "exported").length;
    const reviewed = accepted + rejected;
    return {
      projects: projects.length,
      productOwners: users.filter((u) => u.role === "product_owner").length,
      annotations: anns.length,
      submitted: anns.filter((a) => a.status === "submitted").length,
      tasks: tasks.length,
      accepted,
      rejected,
      exported,
      acceptRate: reviewed === 0 ? null : accepted / reviewed,
    };
  }

  async getPlatformConfig(): Promise<PlatformProviderConfigView | null> {
    const rows = await this.db
      .select()
      .from(schema.platformConfig)
      .where(eq(schema.platformConfig.id, "default"))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      aiProvider: r.aiProvider as PlatformProviderConfig["aiProvider"],
      aiModel: r.aiModel,
      ...(r.aiEndpoint ? { aiEndpoint: r.aiEndpoint } : {}),
      transcriptionProvider:
        r.transcriptionProvider as PlatformProviderConfig["transcriptionProvider"],
      ...(r.transcriptionEndpoint ? { transcriptionEndpoint: r.transcriptionEndpoint } : {}),
      aiKeyConfigured: r.aiKeyRef !== null,
      aiKeyHint: r.aiKeyHint ?? null,
    };
  }

  async getPlatformConfigInternal(): Promise<{
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
  } | null> {
    const rows = await this.db
      .select()
      .from(schema.platformConfig)
      .where(eq(schema.platformConfig.id, "default"))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      config: {
        aiProvider: r.aiProvider as PlatformProviderConfig["aiProvider"],
        aiModel: r.aiModel,
        ...(r.aiEndpoint ? { aiEndpoint: r.aiEndpoint } : {}),
        transcriptionProvider:
          r.transcriptionProvider as PlatformProviderConfig["transcriptionProvider"],
        ...(r.transcriptionEndpoint ? { transcriptionEndpoint: r.transcriptionEndpoint } : {}),
      },
      aiKeyRef: r.aiKeyRef ?? null,
    };
  }

  async setPlatformConfig(args: {
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
    aiKeyHint: string | null;
  }): Promise<PlatformProviderConfigView> {
    const existing = await this.getPlatformConfig();
    const keepKey = args.aiKeyRef === null && existing?.aiKeyConfigured;
    const values = {
      id: "default",
      aiProvider: args.config.aiProvider,
      aiModel: args.config.aiModel,
      aiEndpoint: args.config.aiEndpoint ?? null,
      transcriptionProvider: args.config.transcriptionProvider,
      transcriptionEndpoint: args.config.transcriptionEndpoint ?? null,
      ...(keepKey ? {} : { aiKeyRef: args.aiKeyRef, aiKeyHint: args.aiKeyHint }),
    };
    await this.db
      .insert(schema.platformConfig)
      .values(values)
      .onConflictDoUpdate({ target: schema.platformConfig.id, set: values });
    return (await this.getPlatformConfig()) as PlatformProviderConfigView;
  }

  async addLead(email: string, locale: "pl" | "en" | null): Promise<Lead> {
    const inserted = await this.db
      .insert(schema.leads)
      .values({ id: newId(), email, locale })
      .returning();
    const r = inserted[0] as typeof schema.leads.$inferSelect;
    return {
      id: r.id,
      email: r.email,
      locale: (r.locale as Lead["locale"]) ?? null,
      at: r.createdAt,
    };
  }

  async listLeads(limit: number): Promise<Lead[]> {
    const rows = await this.db
      .select()
      .from(schema.leads)
      .orderBy(desc(schema.leads.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      locale: (r.locale as Lead["locale"]) ?? null,
      at: r.createdAt,
    }));
  }
}
