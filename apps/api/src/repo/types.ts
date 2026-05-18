import type {
  Annotation,
  CreateAnnotationInput,
  ExportConfig,
  ExportTarget,
  PanelAudience,
  Panel,
  PanelStatus,
  Project,
  ProjectTemplate,
  Submission,
  User,
  UserRole,
} from "@speqify/shared";

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
