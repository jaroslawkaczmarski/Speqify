import type {
  AdminStats,
  Annotation,
  AnalysisRun,
  AuditEntry,
  CreateAnnotationInput,
  ExportConfig,
  ExportTarget,
  Lead,
  PlatformProviderConfig,
  PlatformProviderConfigView,
  Project,
  ProjectStatus,
  ProjectTemplates,
  Reviewer,
  ReviewerStatus,
  ReviewSession,
  ReviewSessionStatus,
  Submission,
  SubtaskType,
  Task,
  TranscriptionStatus,
  User,
  UserRole,
} from "@speqify/shared";

export interface TaskDraftInput {
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  labels: string[];
  component: string | null;
  version: string | null;
  priority: "low" | "medium" | "high" | null;
  confidence: number | null;
  subtaskType: SubtaskType | null;
  annotationIds: string[];
  screenshotKeys: string[];
}

/** Fields a rev-guarded task mutation may set (edit / accept / reject / regen). */
export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "acceptanceCriteria"
    | "labels"
    | "component"
    | "version"
    | "priority"
    | "subtaskType"
    | "confidence"
    | "status"
    | "reviewedAt"
    | "externalId"
    | "exportError"
  >
>;

export type TaskMutation =
  | { ok: true; task: Task }
  | { ok: false; reason: "not_found" | "conflict" };

export type UserWithSecret = User & { passwordHash: string | null };

export interface AnnotationCreate {
  sessionId: string;
  reviewerId: string;
  correlationId: string;
  input: CreateAnnotationInput;
}

/** Editable fields on a ReviewSession (any non-status field). */
export type ReviewSessionPatch = Partial<
  Pick<ReviewSession, "name" | "description" | "instructions" | "envUrl" | "startsAt" | "endsAt">
>;

export interface CreateReviewSessionArgs {
  projectId: string;
  name: string;
  description: string;
  instructions: string;
  envUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string;
  token: string;
}

export interface AddReviewerArgs {
  sessionId: string;
  name: string;
  email: string;
  token: string;
}

/**
 * Data port. Handlers depend on this, not on D1 — so the whole request flow is
 * unit-testable with the in-memory adapter (no Cloudflare needed in CI).
 */
export interface Repository {
  // --- SDK ingest (token-gated) ---

  getOrCreateSubmission(args: {
    sessionId: string;
    reviewerId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission>;

  /** Idempotent on (sessionId, reviewerId, input.clientAnnotationId) — safe for SDK retries (§14). */
  upsertAnnotation(args: AnnotationCreate): Promise<{ annotation: Annotation; created: boolean }>;

  /** Marks the submission complete and transitions its draft annotations -> submitted. */
  completeSubmission(args: { sessionId: string; submissionId: string }): Promise<boolean>;

  getUserByEmail(email: string): Promise<UserWithSecret | null>;

  // --- Transcription (Phase 6) ---

  /** Submitted annotations with audio that still need a transcript. */
  listTranscribable(limit: number): Promise<Annotation[]>;

  getAnnotationById(id: string): Promise<Annotation | null>;

  setTranscription(
    id: string,
    transcript: string | null,
    status: TranscriptionStatus,
  ): Promise<Annotation | null>;

  // --- AI analysis (Phase 7, §14) ---

  /** Acquire the single in-flight analysis lock for a project (null if busy). */
  startAnalysisRun(projectId: string): Promise<AnalysisRun | null>;

  finishAnalysisRun(
    runId: string,
    status: "succeeded" | "failed",
    annotationIds: string[],
    error: string | null,
  ): Promise<void>;

  /** Snapshot: submitted, not-yet-processed annotations for a project. */
  listSubmittedForProject(projectId: string): Promise<Annotation[]>;

  /** Insert generated tasks; parents before subtasks. Never mutates existing. */
  createTasks(drafts: TaskDraftInput[]): Promise<Task[]>;

  /** draft/submitted -> processed for the given ids (post-persist, §14). */
  markAnnotationsProcessed(ids: string[]): Promise<void>;

  listTasks(projectId: string): Promise<Task[]>;

  // --- PO review (Phase 8) ---

  getTask(id: string): Promise<Task | null>;

  /** Resolve a task's source annotations (PO review "Adnotacje źródłowe"). */
  getAnnotationsByIds(ids: string[]): Promise<Annotation[]>;

  /**
   * Optimistic-locked task mutation: applies `patch` only if `expectedRev`
   * matches the current `Task.rev`, then bumps `rev`. Transition/ownership
   * validity is enforced by the caller; this is the atomic write primitive.
   */
  updateTask(id: string, expectedRev: number, patch: TaskPatch): Promise<TaskMutation>;

  // --- SuperAdmin (Phase 2) ---

  listUsers(): Promise<User[]>;

  createUser(args: {
    role: UserRole;
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User>;

  listProjects(): Promise<Project[]>;

  getProject(id: string): Promise<Project | null>;

  createProject(args: {
    name: string;
    productOwnerId: string;
    environmentUrls: string[];
    templates: ProjectTemplates;
  }): Promise<Project>;

  // --- Review sessions (RS-3) ---

  createReviewSession(args: CreateReviewSessionArgs): Promise<ReviewSession>;

  getReviewSession(id: string): Promise<ReviewSession | null>;

  getReviewSessionByToken(token: string): Promise<ReviewSession | null>;

  listReviewSessionsByProject(projectId: string): Promise<ReviewSession[]>;

  updateReviewSession(id: string, patch: ReviewSessionPatch): Promise<ReviewSession | null>;

  setReviewSessionStatus(id: string, status: ReviewSessionStatus): Promise<ReviewSession | null>;

  // --- Reviewers (RS-3) ---

  addReviewer(args: AddReviewerArgs): Promise<Reviewer>;

  getReviewer(id: string): Promise<Reviewer | null>;

  getReviewerByToken(token: string): Promise<Reviewer | null>;

  listReviewersBySession(sessionId: string): Promise<Reviewer[]>;

  /** PO revoke — sets status → declined. Idempotent. */
  revokeReviewer(id: string): Promise<Reviewer | null>;

  /** Idempotent: first call flips pending → active and stamps `acceptedAt`. */
  markReviewerAccepted(id: string): Promise<Reviewer | null>;

  /** Touch `lastSeenAt` (no status side-effect). */
  markReviewerSeen(id: string, at: string): Promise<void>;

  // --- SA dashboard real data (Tranche B / Phase 11) ---

  setProjectStatus(projectId: string, status: ProjectStatus): Promise<Project | null>;

  appendAudit(entry: {
    kind: string;
    actor: string;
    summary: string;
    severity: "ok" | "warn" | "danger";
    projectId: string | null;
  }): Promise<void>;

  listAudit(limit: number): Promise<AuditEntry[]>;

  /** Live aggregates for the SA stat cards. */
  getAdminStats(): Promise<AdminStats>;

  /** Closed-beta lead from the landing page (no self-serve signup, §11). */
  addLead(email: string, locale: "pl" | "en" | null): Promise<Lead>;

  listLeads(limit: number): Promise<Lead[]>;

  getPlatformConfig(): Promise<PlatformProviderConfigView | null>;

  /** Internal: returns the encrypted `aiKeyRef` for runtime decryption.
   *  NEVER expose this to clients — used only by `buildRuntime` to construct
   *  the LLM provider from SA Providers config. */
  getPlatformConfigInternal(): Promise<{
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
  } | null>;

  /** `aiKeyRef`/`aiKeyHint` are pre-computed by the caller (envelope-encrypted). */
  setPlatformConfig(args: {
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
    aiKeyHint: string | null;
  }): Promise<PlatformProviderConfigView>;

  // --- Product Owner config (Phase 3) ---

  getProjectByOwner(ownerId: string): Promise<Project | null>;

  updateProjectTemplates(projectId: string, templates: ProjectTemplates): Promise<Project | null>;

  getExportConfig(projectId: string): Promise<ExportConfig | null>;

  upsertExportConfig(args: {
    projectId: string;
    target: ExportTarget;
    encryptedCredentialsRef: string | null;
    fieldMapping: Record<string, string>;
    defaults: Record<string, string>;
  }): Promise<ExportConfig>;
}

// `ReviewerStatus` re-export keeps the symbol available to importers that
// pulled it through `repo/types` historically; harmless if unused.
export type { ReviewerStatus };
