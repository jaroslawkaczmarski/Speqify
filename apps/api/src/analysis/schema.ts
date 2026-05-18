/** Structured-output contract for AI task generation (§14: validate + repair). */
import { z } from "zod";

const baseTask = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000).default(""),
  acceptanceCriteria: z.array(z.string().max(2_000)).max(30).default([]),
  labels: z.array(z.string().max(64)).max(30).default([]),
  component: z.string().max(120).nullable().default(null),
  version: z.string().max(64).nullable().default(null),
  priority: z.enum(["low", "medium", "high"]).nullable().default(null),
  annotationIds: z.array(z.string().max(64)).max(200).default([]),
});

export const taskDraftSchema = baseTask.extend({
  subtasks: z.array(baseTask).max(50).default([]),
});

export const analysisOutputSchema = z.object({
  tasks: z.array(taskDraftSchema).max(200),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type TaskDraft = z.infer<typeof taskDraftSchema>;
/** A task without nested subtasks (parent and child share these fields). */
export type TaskCore = z.infer<typeof baseTask>;

/** Tolerant parse: strips ``` fences, then schema-validates. */
export function parseAnalysisOutput(raw: string): AnalysisOutput | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const parsed = analysisOutputSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
