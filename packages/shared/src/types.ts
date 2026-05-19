/**
 * Core domain model (IMPLEMENTATION_PLAN.md §4).
 *
 * These are storage-agnostic shapes. The Drizzle schema in `@speqify/db` is the
 * physical mapping; these types are the contract shared across API / panel / SDK.
 */
import type {
  AnnotationStatus,
  AnnotationType,
  PanelAudience,
  PanelStatus,
  ProjectStatus,
  TaskStatus,
  TranscriptionStatus,
  UserRole,
} from "./states.js";

export type Id = string;
export type IsoTimestamp = string;

/** Object stored in R2 — we keep the key + metadata in D1, never the blob. */
export interface MediaRef {
  bucketKey: string;
  contentType: string;
  bytes: number;
  /** Stable, long-lived, unguessable public URL for embedding in exported tickets (§14). */
  publicUrl?: string;
}

export interface User {
  id: Id;
  role: UserRole;
  email: string;
  displayName: string;
  createdAt: IsoTimestamp;
}

export interface Project {
  id: Id;
  name: string;
  /** Exactly one PO per project in V1 (§11). */
  productOwnerId: Id;
  /** Allowed environment origins — also the CORS allowlist for ingest (§9). */
  environmentUrls: string[];
  /** SA-controlled lifecycle (design SA projects table status pill). */
  status: ProjectStatus;
  template: ProjectTemplate;
  exportConfigId: Id | null;
  createdAt: IsoTimestamp;
}

export interface ProjectTemplate {
  language: "pl" | "en";
  userStory: boolean;
  acceptanceCriteria: boolean;
  labels: string[];
  components: string[];
  versions: string[];
  customFields: Record<string, string>;
}

export type ExportTarget = "jira" | "github" | "json" | "csv";

export interface ExportConfig {
  id: Id;
  projectId: Id;
  target: ExportTarget;
  /** Stored envelope-encrypted in D1; never returned in plaintext to clients (§9). */
  encryptedCredentialsRef: string | null;
  fieldMapping: Record<string, string>;
  defaults: Record<string, string>;
}

export interface Panel {
  id: Id;
  projectId: Id;
  audience: PanelAudience;
  /** Capability token — unguessable, revocable, scoped to panel+role+env (§9). */
  secretToken: string;
  environmentUrl: string;
  status: PanelStatus;
  createdAt: IsoTimestamp;
}

/** A reviewer's "Send" batch — the unit AI analysis snapshots (§4, §14). */
export interface Submission {
  id: Id;
  panelId: Id;
  /** Ephemeral per-browser client id; reviewers have no account in V1. */
  clientId: string;
  complete: boolean;
  createdAt: IsoTimestamp;
}

export interface ElementRef {
  selector: string;
  xpath: string;
  html: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

/** Automatic technical envelope — the Usersnap insight (§13). */
export interface TechnicalContext {
  consoleEntries: { level: string; message: string; at: IsoTimestamp }[];
  jsErrors: { message: string; stack?: string; at: IsoTimestamp }[];
  network: {
    method: string;
    url: string;
    status: number;
    at: IsoTimestamp;
  }[];
  browser: string;
  os: string;
  screen: { w: number; h: number; dpr: number };
}

/** Host-app provided context via SDK init (build/env/user/flags) (§13). */
export interface HostAppContext {
  appVersion?: string;
  buildSha?: string;
  environment?: string;
  testUser?: string;
  featureFlags?: Record<string, boolean>;
}

export interface NavigationStep {
  url: string;
  at: IsoTimestamp;
  action?: string;
}

export interface Annotation {
  id: Id;
  panelId: Id;
  submissionId: Id;
  type: AnnotationType;
  status: AnnotationStatus;
  audience: PanelAudience;
  pageUrl: string;
  breadcrumb: NavigationStep[];
  element: ElementRef | null;
  screenshot: MediaRef | null;
  voice: MediaRef | null;
  /** Screen recording: video + the parallel mic-audio used for transcription (§14). */
  recordingVideo: MediaRef | null;
  recordingAudio: MediaRef | null;
  transcript: string | null;
  transcriptionStatus: TranscriptionStatus | null;
  textNote: string | null;
  /** Free-form reviewer labels (overlay "Etykiety"). */
  tags: string[];
  /** Lightweight structured signal captured on the overlay form (§13). */
  structured: { kind: "bug" | "change"; severity: "low" | "medium" | "high" } | null;
  technical: TechnicalContext | null;
  hostApp: HostAppContext | null;
  /** Client-generated for idempotent Send; server stamps authoritative time (§14). */
  clientCreatedAt: IsoTimestamp;
  serverCreatedAt: IsoTimestamp;
  correlationId: string;
}

/** Sub-task discipline tag (design "Backend / Frontend / Integration" chip). */
export type SubtaskType = "backend" | "frontend" | "integration" | "other";

export interface Task {
  id: Id;
  projectId: Id;
  status: TaskStatus;
  parentTaskId: Id | null;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  labels: string[];
  component: string | null;
  /** Product/release version (e.g. "1.0"), not the optimistic-lock rev. */
  version: string | null;
  priority: "low" | "medium" | "high" | null;
  /** AI confidence 0–1 (design review list/detail). Null until analysis sets it. */
  confidence: number | null;
  /** Sub-task discipline; null for parent tasks. */
  subtaskType: SubtaskType | null;
  annotationIds: Id[];
  screenshotKeys: string[];
  /** External issue id once exported — also the idempotency key (§14). */
  externalId: string | null;
  exportError: string | null;
  /** PO review timestamp (accept/reject); null while `generated`. */
  reviewedAt: IsoTimestamp | null;
  /** Optimistic-lock revision; bumped on every PO edit/transition (§14). */
  rev: number;
  createdAt: IsoTimestamp;
}

/** Editable fields a PO may change while a task is `generated` (Phase 8). */
export interface TaskEditInput {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  labels: string[];
  component: string | null;
  version: string | null;
  priority: "low" | "medium" | "high" | null;
  subtaskType: SubtaskType | null;
  /** Optimistic-lock guard — must equal the current `Task.rev`. */
  expectedRev: number;
}

/** Resolved source annotation for the PO review detail ("Adnotacje źródłowe"). */
export interface PoSourceAnnotation {
  id: Id;
  type: AnnotationType;
  selector: string | null;
  textNote: string | null;
  transcript: string | null;
  transcriptionStatus: TranscriptionStatus | null;
  voiceUrl: string | null;
  screenshotUrl: string | null;
  tags: string[];
  structured: { kind: "bug" | "change"; severity: "low" | "medium" | "high" } | null;
  createdAt: IsoTimestamp;
}

/** Closed-beta lead from the landing page (no self-serve signup in V1, §11). */
export interface Lead {
  id: Id;
  email: string;
  locale: "pl" | "en" | null;
  at: IsoTimestamp;
}

/** A single AI analysis run; annotations are claimed against `id` (§14). */
export interface AnalysisRun {
  id: Id;
  projectId: Id;
  status: "running" | "succeeded" | "failed";
  annotationIds: Id[];
  startedAt: IsoTimestamp;
  finishedAt: IsoTimestamp | null;
  error: string | null;
}

/** Platform-wide provider config (SuperAdmin, §9). Keys live in Secrets Store. */
export interface PlatformProviderConfig {
  aiProvider: "claude" | "openai" | "openrouter" | "gemini" | "azure" | "custom";
  aiModel: string;
  aiEndpoint?: string;
  transcriptionProvider: "workers-ai" | "groq" | "openai" | "azure" | "self-hosted";
  transcriptionEndpoint?: string;
}

/** Stored platform provider config + masked key echo (SA "Dostawcy AI"). */
export interface PlatformProviderConfigView extends PlatformProviderConfig {
  /** True once an API key has been saved (never echoed in plaintext, §9). */
  aiKeyConfigured: boolean;
  /** Last 4 chars of the saved AI key, for recognisability only. */
  aiKeyHint: string | null;
}

/** Append-only operational event (SA "Ostatnie zdarzenia" / audit log). */
export interface AuditEntry {
  id: Id;
  at: IsoTimestamp;
  /** Stable machine kind, e.g. "project.created", "analysis.finished". */
  kind: string;
  actor: string;
  summary: string;
  severity: "ok" | "warn" | "danger";
  projectId: Id | null;
}

/** Live aggregates feeding the SA dashboard stat cards. */
export interface AdminStats {
  projects: number;
  productOwners: number;
  annotations: number;
  submitted: number;
  tasks: number;
  accepted: number;
  rejected: number;
  exported: number;
  /** accepted / (accepted + rejected), 0–1; null when nothing reviewed yet. */
  acceptRate: number | null;
}

export interface ApiError {
  error: { code: string; message: string; correlationId?: string };
}
