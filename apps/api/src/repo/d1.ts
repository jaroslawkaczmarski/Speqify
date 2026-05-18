import { and, eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@speqify/db/schema";
import type {
  Annotation,
  AnnotationStatus,
  AnnotationType,
  PanelAudience,
  PanelStatus,
  Panel,
  Submission,
  UserRole,
} from "@speqify/shared";
import { newId } from "../lib/ids.js";
import type { AnnotationCreate, Repository, UserWithSecret } from "./types.js";

type Db = DrizzleD1Database<typeof schema>;
type PanelRow = typeof schema.panels.$inferSelect;
type SubmissionRow = typeof schema.submissions.$inferSelect;
type AnnotationRow = typeof schema.annotations.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;

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
}
