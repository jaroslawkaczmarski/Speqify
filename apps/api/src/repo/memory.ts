import type {
  Annotation,
  ExportConfig,
  ExportTarget,
  Panel,
  PanelAudience,
  Project,
  ProjectTemplate,
  Submission,
  User,
  UserRole,
} from "@speqify/shared";
import { newId } from "../lib/ids.js";
import type { AnnotationCreate, Repository, UserWithSecret } from "./types.js";

/**
 * In-memory Repository — used by unit tests and local dev without D1.
 * Behaviour is the contract the D1 adapter must match.
 */
export class InMemoryRepository implements Repository {
  private panels = new Map<string, Panel>();
  private submissions = new Map<string, Submission>();
  private annotations = new Map<string, Annotation>();
  private users = new Map<string, UserWithSecret>();
  private projects = new Map<string, Project>();
  private exportConfigs = new Map<string, ExportConfig>();

  constructor(seed?: { panels?: Panel[]; users?: UserWithSecret[]; projects?: Project[] }) {
    for (const p of seed?.panels ?? []) this.panels.set(p.secretToken, p);
    for (const u of seed?.users ?? []) this.users.set(u.email.toLowerCase(), u);
    for (const p of seed?.projects ?? []) this.projects.set(p.id, p);
  }

  async getPanelByToken(token: string): Promise<Panel | null> {
    return this.panels.get(token) ?? null;
  }

  async getOrCreateSubmission(args: {
    panelId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission> {
    const key = `${args.panelId}:${args.submissionId}`;
    const existing = this.submissions.get(key);
    if (existing) return existing;
    const created: Submission = {
      id: args.submissionId,
      panelId: args.panelId,
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
    const idemKey = `${args.panelId}:${input.clientAnnotationId}`;
    const existing = this.annotations.get(idemKey);
    if (existing) return { annotation: existing, created: false };

    const annotation: Annotation = {
      id: newId(),
      panelId: args.panelId,
      submissionId: input.submissionId,
      type: input.type,
      status: "draft",
      audience: args.audience,
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

  async completeSubmission(args: { panelId: string; submissionId: string }): Promise<boolean> {
    const key = `${args.panelId}:${args.submissionId}`;
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
    template: ProjectTemplate;
  }): Promise<Project> {
    const project: Project = {
      id: newId(),
      name: args.name,
      productOwnerId: args.productOwnerId,
      environmentUrls: args.environmentUrls,
      template: args.template,
      exportConfigId: null,
      createdAt: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  async createPanel(args: {
    projectId: string;
    audience: PanelAudience;
    environmentUrl: string;
    secretToken: string;
  }): Promise<Panel> {
    const panel: Panel = {
      id: newId(),
      projectId: args.projectId,
      audience: args.audience,
      secretToken: args.secretToken,
      environmentUrl: args.environmentUrl,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    this.panels.set(panel.secretToken, panel);
    return panel;
  }

  async listPanels(projectId: string): Promise<Panel[]> {
    return [...this.panels.values()].filter((p) => p.projectId === projectId);
  }

  async getProjectByOwner(ownerId: string): Promise<Project | null> {
    return [...this.projects.values()].find((p) => p.productOwnerId === ownerId) ?? null;
  }

  async updateProjectTemplate(
    projectId: string,
    template: ProjectTemplate,
  ): Promise<Project | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;
    project.template = template;
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
}
