/**
 * State machines & enums (IMPLEMENTATION_PLAN.md §4, §14).
 *
 * Transitions are the single authority for lifecycle correctness. The API and
 * workflows MUST validate every transition through `canTransition*` rather than
 * mutating status directly.
 */

// ---------------------------------------------------------------------------
// Roles & audiences
// ---------------------------------------------------------------------------

export const UserRole = {
  SuperAdmin: "superadmin",
  ProductOwner: "product_owner",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** A panel's intended audience; inherited by every annotation captured through it. */
export const PanelAudience = {
  Client: "client",
  Tester: "tester",
  ProductOwner: "po",
} as const;
export type PanelAudience = (typeof PanelAudience)[keyof typeof PanelAudience];

// ---------------------------------------------------------------------------
// Panel lifecycle
// ---------------------------------------------------------------------------

export const PanelStatus = {
  Open: "open",
  Closed: "closed",
} as const;
export type PanelStatus = (typeof PanelStatus)[keyof typeof PanelStatus];

/** Project lifecycle (SA-controlled, no strict machine — any → any). */
export const ProjectStatus = {
  Live: "live",
  Paused: "paused",
  Archived: "archived",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

const PANEL_TRANSITIONS: Record<PanelStatus, readonly PanelStatus[]> = {
  open: ["closed"],
  closed: ["open"],
};

// ---------------------------------------------------------------------------
// Annotation lifecycle:  draft --Send--> submitted --AI analysis--> processed
// ---------------------------------------------------------------------------

export const AnnotationStatus = {
  Draft: "draft",
  Submitted: "submitted",
  Processed: "processed",
} as const;
export type AnnotationStatus = (typeof AnnotationStatus)[keyof typeof AnnotationStatus];

const ANNOTATION_TRANSITIONS: Record<AnnotationStatus, readonly AnnotationStatus[]> = {
  draft: ["submitted"],
  submitted: ["processed"],
  processed: [],
};

export const AnnotationType = {
  Element: "element",
  Global: "global",
  Voice: "voice",
  Recording: "recording",
} as const;
export type AnnotationType = (typeof AnnotationType)[keyof typeof AnnotationType];

// ---------------------------------------------------------------------------
// Task lifecycle:
//   generated --review--> accepted | rejected
//   accepted  --export--> exported | export_failed
//   export_failed --retry--> exported
// ---------------------------------------------------------------------------

export const TaskStatus = {
  Generated: "generated",
  Accepted: "accepted",
  Rejected: "rejected",
  Exported: "exported",
  ExportFailed: "export_failed",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  generated: ["accepted", "rejected"],
  accepted: ["exported", "export_failed"],
  rejected: [],
  export_failed: ["exported"],
  exported: [],
};

// ---------------------------------------------------------------------------
// Transcription job lifecycle (Phase 6). Superseded = a newer recording replaced
// this one before it finished; never attach a superseded transcript (§14).
// ---------------------------------------------------------------------------

export const TranscriptionStatus = {
  Queued: "queued",
  Running: "running",
  Done: "done",
  Failed: "failed",
  Superseded: "superseded",
} as const;
export type TranscriptionStatus = (typeof TranscriptionStatus)[keyof typeof TranscriptionStatus];

// ---------------------------------------------------------------------------
// Generic guard
// ---------------------------------------------------------------------------

function canTransition<T extends string>(map: Record<T, readonly T[]>, from: T, to: T): boolean {
  return map[from]?.includes(to) ?? false;
}

export const canTransitionPanel = (from: PanelStatus, to: PanelStatus): boolean =>
  canTransition(PANEL_TRANSITIONS, from, to);

export const canTransitionAnnotation = (from: AnnotationStatus, to: AnnotationStatus): boolean =>
  canTransition(ANNOTATION_TRANSITIONS, from, to);

export const canTransitionTask = (from: TaskStatus, to: TaskStatus): boolean =>
  canTransition(TASK_TRANSITIONS, from, to);

/** Statuses an AI analysis run is allowed to consume (snapshot at run start, §14). */
export const ANALYZABLE_ANNOTATION_STATUS: AnnotationStatus = AnnotationStatus.Submitted;

/** Tasks an analysis re-run must never mutate (§14). */
export const IMMUTABLE_TASK_STATUSES: readonly TaskStatus[] = [
  TaskStatus.Accepted,
  TaskStatus.Exported,
  TaskStatus.ExportFailed,
];
