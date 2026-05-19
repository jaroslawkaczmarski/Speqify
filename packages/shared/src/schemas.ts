/**
 * Wire schemas for the SDK -> API ingest boundary.
 *
 * All captured content is UNTRUSTED (prompt-injection hardening, §14): these
 * schemas bound shape & size only — they never imply the content is safe to
 * treat as instructions.
 */
import { z } from "zod";

export const idSchema = z.string().min(1).max(64);

export const mediaRefSchema = z.object({
  bucketKey: z.string().min(1).max(512),
  contentType: z.string().min(1).max(128),
  bytes: z.number().int().nonnegative(),
  publicUrl: z.string().url().optional(),
});

export const elementRefSchema = z.object({
  selector: z.string().max(2_000),
  xpath: z.string().max(2_000),
  html: z.string().max(20_000),
  boundingBox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
});

export const navigationStepSchema = z.object({
  url: z.string().url().max(2_048),
  at: z.string().datetime(),
  action: z.string().max(120).optional(),
});

export const structuredSchema = z.object({
  kind: z.enum(["bug", "change"]),
  severity: z.enum(["low", "medium", "high"]),
});

/** Capped to bound payload + cost (§14). Deeper scrubbing happens server-side. */
export const technicalContextSchema = z.object({
  consoleEntries: z
    .array(
      z.object({
        level: z.string().max(16),
        message: z.string().max(4_000),
        at: z.string().datetime(),
      }),
    )
    .max(200),
  jsErrors: z
    .array(
      z.object({
        message: z.string().max(4_000),
        stack: z.string().max(8_000).optional(),
        at: z.string().datetime(),
      }),
    )
    .max(100),
  network: z
    .array(
      z.object({
        method: z.string().max(10),
        url: z.string().max(2_048),
        status: z.number().int(),
        at: z.string().datetime(),
      }),
    )
    .max(200),
  browser: z.string().max(256),
  os: z.string().max(128),
  screen: z.object({
    w: z.number().int(),
    h: z.number().int(),
    dpr: z.number(),
  }),
});

export const hostAppContextSchema = z.object({
  appVersion: z.string().max(64).optional(),
  buildSha: z.string().max(64).optional(),
  environment: z.string().max(64).optional(),
  testUser: z.string().max(256).optional(),
  featureFlags: z.record(z.boolean()).optional(),
});

/** Body of POST /panels/:token/annotations — client-generated ids = idempotent. */
export const createAnnotationSchema = z.object({
  clientAnnotationId: idSchema,
  submissionId: idSchema,
  /** Ephemeral per-browser id; binds the annotation's submission batch. */
  clientId: z.string().min(1).max(64),
  type: z.enum(["element", "global", "voice", "recording"]),
  pageUrl: z.string().url().max(2_048),
  breadcrumb: z.array(navigationStepSchema).max(50).default([]),
  element: elementRefSchema.nullable().default(null),
  screenshot: mediaRefSchema.nullable().default(null),
  voice: mediaRefSchema.nullable().default(null),
  recordingVideo: mediaRefSchema.nullable().default(null),
  recordingAudio: mediaRefSchema.nullable().default(null),
  textNote: z.string().max(10_000).nullable().default(null),
  /** Free-form reviewer labels (overlay "Etykiety"); AI uses them as hints. */
  tags: z.array(z.string().max(64)).max(20).default([]),
  structured: structuredSchema.nullable().default(null),
  technical: technicalContextSchema.nullable().default(null),
  hostApp: hostAppContextSchema.nullable().default(null),
  clientCreatedAt: z.string().datetime(),
});
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;

export const submitSchema = z.object({
  submissionId: idSchema,
  clientId: z.string().min(1).max(64),
});
export type SubmitInput = z.infer<typeof submitSchema>;

/** Body of PUT /po/tasks/:id — PO inline edit while a task is `generated`. */
export const taskEditSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000),
  acceptanceCriteria: z.array(z.string().max(2_000)).max(30),
  labels: z.array(z.string().max(64)).max(30),
  component: z.string().max(120).nullable(),
  version: z.string().max(64).nullable(),
  priority: z.enum(["low", "medium", "high"]).nullable(),
  subtaskType: z.enum(["backend", "frontend", "integration", "other"]).nullable(),
  expectedRev: z.number().int().nonnegative(),
});

/** Body of POST /po/tasks/:id/{accept,reject,regenerate} — optimistic guard. */
export const taskActionSchema = z.object({
  expectedRev: z.number().int().nonnegative(),
  reason: z.string().max(2_000).optional(),
});

/** Body of POST /admin/projects/:id/status. */
export const projectStatusSchema = z.object({
  status: z.enum(["live", "paused", "archived"]),
});

/** Body of PUT /admin/providers — platform AI/transcription config (SA, §9). */
export const providerConfigSchema = z.object({
  aiProvider: z.enum(["claude", "openai", "gemini", "azure", "custom"]),
  aiModel: z.string().min(1).max(120),
  aiEndpoint: z.string().url().max(2_048).optional(),
  /** Write-only; never echoed back in plaintext. Omit/blank to keep existing. */
  aiKey: z.string().max(4_096).optional(),
  transcriptionProvider: z.enum(["workers-ai", "groq", "openai", "azure", "self-hosted"]),
  transcriptionEndpoint: z.string().url().max(2_048).optional(),
});

/** Body of POST /leads — closed-beta lead from the landing page. */
export const leadSchema = z.object({
  email: z.string().email().max(320),
  locale: z.enum(["pl", "en"]).optional(),
});

/** Body of POST /panels/:token/uploads — request a scoped R2 upload target. */
export const requestUploadSchema = z.object({
  submissionId: idSchema,
  kind: z.enum(["screenshot", "voice", "recording-video", "recording-audio"]),
  contentType: z.string().min(1).max(128),
  bytes: z
    .number()
    .int()
    .positive()
    .max(512 * 1024 * 1024),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;
