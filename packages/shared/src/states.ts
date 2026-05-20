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

/** Project lifecycle (SA-controlled, no strict machine — any → any). */
export const ProjectStatus = {
  Live: "live",
  Paused: "paused",
  Archived: "archived",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

// ---------------------------------------------------------------------------
// Review session lifecycle (the "campaign" window that activates the SDK UI
// for a specific group of reviewers).
//
//   draft  --PO publishes--> live
//   live   --PO closes-------> closed
//   draft  --PO discards-----> closed
// ---------------------------------------------------------------------------

export const ReviewSessionStatus = {
  Draft: "draft",
  Live: "live",
  Closed: "closed",
} as const;
export type ReviewSessionStatus = (typeof ReviewSessionStatus)[keyof typeof ReviewSessionStatus];

const REVIEW_SESSION_TRANSITIONS: Record<ReviewSessionStatus, readonly ReviewSessionStatus[]> = {
  draft: ["live", "closed"],
  live: ["closed"],
  closed: [],
};

// ---------------------------------------------------------------------------
// Reviewer (invitee) status — driven by their interaction with the magic link.
//   pending  --first SDK welcome accept-----> active
//   pending  --PO revokes invitation--------> declined
//   active   --PO revokes-------------------> declined
// ---------------------------------------------------------------------------

export const ReviewerStatus = {
  Pending: "pending",
  Active: "active",
  Declined: "declined",
} as const;
export type ReviewerStatus = (typeof ReviewerStatus)[keyof typeof ReviewerStatus];

// ---------------------------------------------------------------------------
// Task type — controls which per-type ProjectTemplate analysis applies.
// ---------------------------------------------------------------------------

export const TaskType = {
  Bug: "bug",
  Change: "change",
  Feature: "feature",
  Polish: "polish",
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const TASK_TYPES: readonly TaskType[] = [
  TaskType.Bug,
  TaskType.Change,
  TaskType.Feature,
  TaskType.Polish,
];

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

export const canTransitionReviewSession = (
  from: ReviewSessionStatus,
  to: ReviewSessionStatus,
): boolean => canTransition(REVIEW_SESSION_TRANSITIONS, from, to);

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
