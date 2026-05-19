/**
 * Drizzle schema for D1 (SQLite). Starter — Phase 1 will refine indexes,
 * constraints and migrations. JSON columns hold the structured shapes from
 * `@speqify/shared` (stored as text, typed via `$type`).
 */
import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  ElementRef,
  HostAppContext,
  MediaRef,
  NavigationStep,
  ProjectTemplates,
  TechnicalContext,
} from "@speqify/shared";

const id = () => text("id").primaryKey();
const now = () =>
  text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const users = sqliteTable("users", {
  id: id(),
  role: text("role").notNull(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  // PBKDF2 hash for Product Owner accounts. SuperAdmin authenticates via a
  // platform secret (Secrets Store) and may have no hash here (§9, §11).
  passwordHash: text("password_hash"),
  createdAt: now(),
});

export const projects = sqliteTable("projects", {
  id: id(),
  name: text("name").notNull(),
  productOwnerId: text("product_owner_id")
    .notNull()
    .references(() => users.id),
  environmentUrls: text("environment_urls", { mode: "json" }).notNull().$type<string[]>(),
  // SA-controlled lifecycle (design SA projects table).
  status: text("status").notNull().default("live"),
  // Per-task-type templates (bug / change / feature / polish).
  templates: text("templates", { mode: "json" }).notNull().$type<ProjectTemplates>(),
  exportConfigId: text("export_config_id"),
  createdAt: now(),
});

// Append-only operational events (SA audit log / "Ostatnie zdarzenia").
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    kind: text("kind").notNull(),
    actor: text("actor").notNull(),
    summary: text("summary").notNull(),
    severity: text("severity").notNull().default("ok"),
    projectId: text("project_id"),
    createdAt: now(),
  },
  (t) => ({
    byCreated: index("audit_created_idx").on(t.createdAt),
  }),
);

// Singleton platform provider config (SA). Key is envelope-encrypted (§9).
export const platformConfig = sqliteTable("platform_config", {
  id: text("id").primaryKey(), // always "default"
  aiProvider: text("ai_provider").notNull(),
  aiModel: text("ai_model").notNull(),
  aiEndpoint: text("ai_endpoint"),
  aiKeyRef: text("ai_key_ref"),
  aiKeyHint: text("ai_key_hint"),
  transcriptionProvider: text("transcription_provider").notNull(),
  transcriptionEndpoint: text("transcription_endpoint"),
});

// Closed-beta leads from the landing page (no self-serve signup in V1, §11).
export const leads = sqliteTable("leads", {
  id: id(),
  email: text("email").notNull(),
  locale: text("locale"),
  createdAt: now(),
});

export const exportConfigs = sqliteTable("export_configs", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  target: text("target").notNull(),
  encryptedCredentialsRef: text("encrypted_credentials_ref"),
  fieldMapping: text("field_mapping", { mode: "json" }).notNull().$type<Record<string, string>>(),
  defaults: text("defaults", { mode: "json" }).notNull().$type<Record<string, string>>(),
});

// A PO-defined campaign window — the SDK only renders UI when a URL carries
// both ?speqify_session=<reviewSessions.token> and ?speqify_reviewer=<reviewers.token>.
export const reviewSessions = sqliteTable(
  "review_sessions",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    envUrl: text("env_url").notNull(),
    // Public session token (in invitation URL). Unique across the platform.
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("draft"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: now(),
  },
  (t) => ({
    byProject: index("review_sessions_project_idx").on(t.projectId),
  }),
);

// One invited person per session. Per-reviewer-per-session secret token is
// the only identity vector (no reviewer accounts in V1, §11).
export const reviewers = sqliteTable(
  "reviewers",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => reviewSessions.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"),
    invitedAt: text("invited_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    acceptedAt: text("accepted_at"),
    lastSeenAt: text("last_seen_at"),
  },
  (t) => ({
    bySession: index("reviewers_session_idx").on(t.sessionId),
  }),
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => reviewSessions.id),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => reviewers.id),
    clientId: text("client_id").notNull(),
    complete: integer("complete", { mode: "boolean" }).notNull().default(false),
    createdAt: now(),
  },
  (t) => ({
    bySession: index("submissions_session_idx").on(t.sessionId),
    byReviewer: index("submissions_reviewer_idx").on(t.reviewerId),
  }),
);

export const annotations = sqliteTable(
  "annotations",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => reviewSessions.id),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => reviewers.id),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id),
    // SDK-generated id — idempotency key for retried Send (§14).
    clientAnnotationId: text("client_annotation_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("draft"),
    pageUrl: text("page_url").notNull(),
    breadcrumb: text("breadcrumb", { mode: "json" }).$type<NavigationStep[]>(),
    element: text("element", { mode: "json" }).$type<ElementRef>(),
    screenshot: text("screenshot", { mode: "json" }).$type<MediaRef>(),
    voice: text("voice", { mode: "json" }).$type<MediaRef>(),
    recordingVideo: text("recording_video", { mode: "json" }).$type<MediaRef>(),
    recordingAudio: text("recording_audio", { mode: "json" }).$type<MediaRef>(),
    transcript: text("transcript"),
    transcriptionStatus: text("transcription_status"),
    textNote: text("text_note"),
    // Free-form reviewer labels (overlay "Etykiety").
    tags: text("tags", { mode: "json" }).notNull().default([]).$type<string[]>(),
    structured: text("structured", { mode: "json" }).$type<{
      kind: "bug" | "change";
      severity: "low" | "medium" | "high";
    }>(),
    technical: text("technical", { mode: "json" }).$type<TechnicalContext>(),
    hostApp: text("host_app", { mode: "json" }).$type<HostAppContext>(),
    clientCreatedAt: text("client_created_at").notNull(),
    serverCreatedAt: now(),
    correlationId: text("correlation_id").notNull(),
  },
  (t) => ({
    bySessionStatus: index("annotations_session_status_idx").on(t.sessionId, t.status),
    bySubmission: index("annotations_submission_idx").on(t.submissionId),
    // Idempotency: same client-supplied id per (session,reviewer) collapses.
    clientIdUq: uniqueIndex("annotations_session_reviewer_client_uq").on(
      t.sessionId,
      t.reviewerId,
      t.clientAnnotationId,
    ),
  }),
);

export const analysisRuns = sqliteTable("analysis_runs", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  status: text("status").notNull().default("running"),
  annotationIds: text("annotation_ids", { mode: "json" }).notNull().$type<string[]>(),
  startedAt: now(),
  finishedAt: text("finished_at"),
  error: text("error"),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    status: text("status").notNull().default("generated"),
    parentTaskId: text("parent_task_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    acceptanceCriteria: text("acceptance_criteria", { mode: "json" }).notNull().$type<string[]>(),
    labels: text("labels", { mode: "json" }).notNull().$type<string[]>(),
    component: text("component"),
    version: text("version"),
    priority: text("priority"),
    // AI confidence 0–1 (Phase 8 review). Nullable until analysis sets it.
    confidence: real("confidence"),
    // Sub-task discipline tag; null for parents.
    subtaskType: text("subtask_type"),
    annotationIds: text("annotation_ids", { mode: "json" }).notNull().$type<string[]>(),
    screenshotKeys: text("screenshot_keys", { mode: "json" }).notNull().$type<string[]>(),
    externalId: text("external_id"),
    exportError: text("export_error"),
    // PO review timestamp (accept/reject); optimistic-lock revision.
    reviewedAt: text("reviewed_at"),
    rev: integer("rev").notNull().default(1),
    createdAt: now(),
  },
  (t) => ({
    byProjectStatus: index("tasks_project_status_idx").on(t.projectId, t.status),
  }),
);

// ---------------------------------------------------------------------------
// Relations (query-layer convenience; FK columns above are the source of truth)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  productOwner: one(users, {
    fields: [projects.productOwnerId],
    references: [users.id],
  }),
  reviewSessions: many(reviewSessions),
  tasks: many(tasks),
  analysisRuns: many(analysisRuns),
  exportConfigs: many(exportConfigs),
}));

export const exportConfigsRelations = relations(exportConfigs, ({ one }) => ({
  project: one(projects, {
    fields: [exportConfigs.projectId],
    references: [projects.id],
  }),
}));

export const reviewSessionsRelations = relations(reviewSessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [reviewSessions.projectId],
    references: [projects.id],
  }),
  reviewers: many(reviewers),
  submissions: many(submissions),
  annotations: many(annotations),
}));

export const reviewersRelations = relations(reviewers, ({ one, many }) => ({
  session: one(reviewSessions, {
    fields: [reviewers.sessionId],
    references: [reviewSessions.id],
  }),
  submissions: many(submissions),
  annotations: many(annotations),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  session: one(reviewSessions, {
    fields: [submissions.sessionId],
    references: [reviewSessions.id],
  }),
  reviewer: one(reviewers, {
    fields: [submissions.reviewerId],
    references: [reviewers.id],
  }),
  annotations: many(annotations),
}));

export const annotationsRelations = relations(annotations, ({ one }) => ({
  session: one(reviewSessions, {
    fields: [annotations.sessionId],
    references: [reviewSessions.id],
  }),
  reviewer: one(reviewers, {
    fields: [annotations.reviewerId],
    references: [reviewers.id],
  }),
  submission: one(submissions, {
    fields: [annotations.submissionId],
    references: [submissions.id],
  }),
}));

export const analysisRunsRelations = relations(analysisRuns, ({ one }) => ({
  project: one(projects, {
    fields: [analysisRuns.projectId],
    references: [projects.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));
