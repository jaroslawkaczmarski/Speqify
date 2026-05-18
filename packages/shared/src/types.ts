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
  /** Lightweight structured signal captured on the overlay form (§13). */
  structured: { kind: "bug" | "change"; severity: "low" | "medium" | "high" } | null;
  technical: TechnicalContext | null;
  hostApp: HostAppContext | null;
  /** Client-generated for idempotent Send; server stamps authoritative time (§14). */
  clientCreatedAt: IsoTimestamp;
  serverCreatedAt: IsoTimestamp;
  correlationId: string;
}

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
  version: string | null;
  priority: "low" | "medium" | "high" | null;
  annotationIds: Id[];
  screenshotKeys: string[];
  /** External issue id once exported — also the idempotency key (§14). */
  externalId: string | null;
  exportError: string | null;
  createdAt: IsoTimestamp;
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
  aiProvider: "claude" | "openai" | "gemini" | "azure" | "custom";
  aiModel: string;
  aiEndpoint?: string;
  transcriptionProvider: "workers-ai" | "groq" | "openai" | "azure" | "self-hosted";
  transcriptionEndpoint?: string;
}

export interface ApiError {
  error: { code: string; message: string; correlationId?: string };
}
