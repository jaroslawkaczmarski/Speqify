/**
 * Drizzle schema for D1 (SQLite). Starter — Phase 1 will refine indexes,
 * constraints and migrations. JSON columns hold the structured shapes from
 * `@speqify/shared` (stored as text, typed via `$type`).
 */
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  ElementRef,
  HostAppContext,
  MediaRef,
  NavigationStep,
  ProjectTemplate,
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
  template: text("template", { mode: "json" }).notNull().$type<ProjectTemplate>(),
  exportConfigId: text("export_config_id"),
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

export const panels = sqliteTable(
  "panels",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    audience: text("audience").notNull(),
    secretToken: text("secret_token").notNull().unique(),
    environmentUrl: text("environment_url").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: now(),
  },
  (t) => ({
    byProject: index("panels_project_idx").on(t.projectId),
  }),
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: id(),
    panelId: text("panel_id")
      .notNull()
      .references(() => panels.id),
    clientId: text("client_id").notNull(),
    complete: integer("complete", { mode: "boolean" }).notNull().default(false),
    createdAt: now(),
  },
  (t) => ({
    byPanel: index("submissions_panel_idx").on(t.panelId),
  }),
);

export const annotations = sqliteTable(
  "annotations",
  {
    id: id(),
    panelId: text("panel_id")
      .notNull()
      .references(() => panels.id),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id),
    // SDK-generated id — idempotency key for retried Send (§14).
    clientAnnotationId: text("client_annotation_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("draft"),
    audience: text("audience").notNull(),
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
    byPanelStatus: index("annotations_panel_status_idx").on(t.panelId, t.status),
    bySubmission: index("annotations_submission_idx").on(t.submissionId),
    clientIdUq: uniqueIndex("annotations_panel_client_uq").on(t.panelId, t.clientAnnotationId),
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
    annotationIds: text("annotation_ids", { mode: "json" }).notNull().$type<string[]>(),
    screenshotKeys: text("screenshot_keys", { mode: "json" }).notNull().$type<string[]>(),
    externalId: text("external_id"),
    exportError: text("export_error"),
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
  panels: many(panels),
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

export const panelsRelations = relations(panels, ({ one, many }) => ({
  project: one(projects, {
    fields: [panels.projectId],
    references: [projects.id],
  }),
  submissions: many(submissions),
  annotations: many(annotations),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  panel: one(panels, {
    fields: [submissions.panelId],
    references: [panels.id],
  }),
  annotations: many(annotations),
}));

export const annotationsRelations = relations(annotations, ({ one }) => ({
  panel: one(panels, {
    fields: [annotations.panelId],
    references: [panels.id],
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
