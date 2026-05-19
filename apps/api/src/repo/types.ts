import type {
  AdminStats,
  Annotation,
  AnalysisRun,
  AuditEntry,
  CreateAnnotationInput,
  ExportConfig,
  ExportTarget,
  Lead,
  PanelAudience,
  Panel,
  PanelStatus,
  PlatformProviderConfig,
  PlatformProviderConfigView,
  Project,
  ProjectStatus,
  ProjectTemplate,
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
  panelId: string;
  audience: PanelAudience;
  correlationId: string;
  input: CreateAnnotationInput;
}

/**
 * Data port. Handlers depend on this, not on D1 — so the whole request flow is
 * unit-testable with the in-memory adapter (no Cloudflare needed in CI).
 */
export interface Repository {
  getPanelByToken(token: string): Promise<Panel | null>;

  getOrCreateSubmission(args: {
    panelId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission>;

  /** Idempotent on (panelId, input.clientAnnotationId) — safe for SDK retries (§14). */
  upsertAnnotation(args: AnnotationCreate): Promise<{ annotation: Annotation; created: boolean }>;

  /** Marks the submission complete and transitions its draft annotations -> submitted. */
  completeSubmission(args: { panelId: string; submissionId: string }): Promise<boolean>;

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
    template: ProjectTemplate;
  }): Promise<Project>;

  createPanel(args: {
    projectId: string;
    audience: PanelAudience;
    environmentUrl: string;
    secretToken: string;
  }): Promise<Panel>;

  listPanels(projectId: string): Promise<Panel[]>;

  getPanelById(panelId: string): Promise<Panel | null>;

  /** Open/close a panel for submissions (§14). */
  updatePanelStatus(panelId: string, status: PanelStatus): Promise<Panel | null>;

  /** Revoke a panel (deletes the capability token) (§9, §14). */
  deletePanel(panelId: string): Promise<boolean>;

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

  /** `aiKeyRef`/`aiKeyHint` are pre-computed by the caller (envelope-encrypted). */
  setPlatformConfig(args: {
    config: PlatformProviderConfig;
    aiKeyRef: string | null;
    aiKeyHint: string | null;
  }): Promise<PlatformProviderConfigView>;

  // --- Product Owner config (Phase 3) ---

  getProjectByOwner(ownerId: string): Promise<Project | null>;

  updateProjectTemplate(projectId: string, template: ProjectTemplate): Promise<Project | null>;

  getExportConfig(projectId: string): Promise<ExportConfig | null>;

  upsertExportConfig(args: {
    projectId: string;
    target: ExportTarget;
    encryptedCredentialsRef: string | null;
    fieldMapping: Record<string, string>;
    defaults: Record<string, string>;
  }): Promise<ExportConfig>;
}
