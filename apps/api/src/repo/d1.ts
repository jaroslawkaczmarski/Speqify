import { and, eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@speqify/db/schema";
import type {
  Annotation,
  AnnotationStatus,
  AnnotationType,
  ExportConfig,
  ExportTarget,
  PanelAudience,
  PanelStatus,
  Panel,
  Project,
  ProjectTemplate,
  Submission,
  TranscriptionStatus,
  User,
  UserRole,
} from "@speqify/shared";
import { newId } from "../lib/ids.js";
import type { AnnotationCreate, Repository, UserWithSecret } from "./types.js";

type Db = DrizzleD1Database<typeof schema>;
type PanelRow = typeof schema.panels.$inferSelect;
type SubmissionRow = typeof schema.submissions.$inferSelect;
type AnnotationRow = typeof schema.annotations.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;

type ExportConfigRow = typeof schema.exportConfigs.$inferSelect;

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
    template: r.template,
    exportConfigId: r.exportConfigId ?? null,
    createdAt: r.createdAt,
  };
}

function toPanel(r: PanelRow): Panel {
  return {
    id: r.id,
    projectId: r.projectId,
    audience: r.audience as PanelAudience,
    secretToken: r.secretToken,
    environmentUrl: r.environmentUrl,
    status: r.status as PanelStatus,
    createdAt: r.createdAt,
  };
}

function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    panelId: r.panelId,
    clientId: r.clientId,
    complete: r.complete,
    createdAt: r.createdAt,
  };
}

function toAnnotation(r: AnnotationRow): Annotation {
  return {
    id: r.id,
    panelId: r.panelId,
    submissionId: r.submissionId,
    type: r.type as AnnotationType,
    status: r.status as AnnotationStatus,
    audience: r.audience as PanelAudience,
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

  async getPanelByToken(token: string): Promise<Panel | null> {
    const rows = await this.db
      .select()
      .from(schema.panels)
      .where(eq(schema.panels.secretToken, token))
      .limit(1);
    return rows[0] ? toPanel(rows[0]) : null;
  }

  async getOrCreateSubmission(args: {
    panelId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission> {
    const existing = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.id, args.submissionId),
          eq(schema.submissions.panelId, args.panelId),
        ),
      )
      .limit(1);
    if (existing[0]) return toSubmission(existing[0]);

    const inserted = await this.db
      .insert(schema.submissions)
      .values({
        id: args.submissionId,
        panelId: args.panelId,
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
          eq(schema.annotations.panelId, args.panelId),
          eq(schema.annotations.clientAnnotationId, input.clientAnnotationId),
        ),
      )
      .limit(1);
    if (existing[0]) return { annotation: toAnnotation(existing[0]), created: false };

    const inserted = await this.db
      .insert(schema.annotations)
      .values({
        id: newId(),
        panelId: args.panelId,
        submissionId: input.submissionId,
        clientAnnotationId: input.clientAnnotationId,
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
        textNote: input.textNote,
        structured: input.structured,
        technical: input.technical,
        hostApp: input.hostApp,
        clientCreatedAt: input.clientCreatedAt,
        correlationId: args.correlationId,
      })
      .returning();
    return { annotation: toAnnotation(inserted[0] as AnnotationRow), created: true };
  }

  async completeSubmission(args: { panelId: string; submissionId: string }): Promise<boolean> {
    const updated = await this.db
      .update(schema.submissions)
      .set({ complete: true })
      .where(
        and(
          eq(schema.submissions.id, args.submissionId),
          eq(schema.submissions.panelId, args.panelId),
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
    template: ProjectTemplate;
  }): Promise<Project> {
    const inserted = await this.db
      .insert(schema.projects)
      .values({
        id: newId(),
        name: args.name,
        productOwnerId: args.productOwnerId,
        environmentUrls: args.environmentUrls,
        template: args.template,
      })
      .returning();
    return toProject(inserted[0] as ProjectRow);
  }

  async createPanel(args: {
    projectId: string;
    audience: PanelAudience;
    environmentUrl: string;
    secretToken: string;
  }): Promise<Panel> {
    const inserted = await this.db
      .insert(schema.panels)
      .values({
        id: newId(),
        projectId: args.projectId,
        audience: args.audience,
        secretToken: args.secretToken,
        environmentUrl: args.environmentUrl,
        status: "open",
      })
      .returning();
    return toPanel(inserted[0] as PanelRow);
  }

  async listPanels(projectId: string): Promise<Panel[]> {
    const rows = await this.db
      .select()
      .from(schema.panels)
      .where(eq(schema.panels.projectId, projectId));
    return rows.map(toPanel);
  }

  async getPanelById(panelId: string): Promise<Panel | null> {
    const rows = await this.db
      .select()
      .from(schema.panels)
      .where(eq(schema.panels.id, panelId))
      .limit(1);
    return rows[0] ? toPanel(rows[0]) : null;
  }

  async updatePanelStatus(panelId: string, status: PanelStatus): Promise<Panel | null> {
    const updated = await this.db
      .update(schema.panels)
      .set({ status })
      .where(eq(schema.panels.id, panelId))
      .returning();
    return updated[0] ? toPanel(updated[0]) : null;
  }

  async deletePanel(panelId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.panels)
      .where(eq(schema.panels.id, panelId))
      .returning();
    return deleted.length > 0;
  }

  async getProjectByOwner(ownerId: string): Promise<Project | null> {
    const rows = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.productOwnerId, ownerId))
      .limit(1);
    return rows[0] ? toProject(rows[0]) : null;
  }

  async updateProjectTemplate(
    projectId: string,
    template: ProjectTemplate,
  ): Promise<Project | null> {
    const updated = await this.db
      .update(schema.projects)
      .set({ template })
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
}
