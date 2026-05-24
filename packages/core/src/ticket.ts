import { z } from "zod";

export const TicketTypeSchema = z.enum(["bug", "feature", "task", "improvement"]);
export type TicketType = z.infer<typeof TicketTypeSchema>;

export const TicketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

/**
 * The structured ticket the AI produces and the user reviews before submit.
 * Storage/tracker-agnostic — adapters map this onto each tracker's payload.
 */
export const TicketSchema = z.object({
  title: z.string().min(1).max(256),
  /** Markdown body — the "what / why". Repro + criteria live in their own fields. */
  description: z.string().default(""),
  type: TicketTypeSchema.default("task"),
  priority: TicketPrioritySchema.nullable().default(null),
  stepsToReproduce: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

export type Ticket = z.infer<typeof TicketSchema>;

export function emptyTicket(): Ticket {
  return {
    title: "",
    description: "",
    type: "task",
    priority: null,
    stepsToReproduce: [],
    acceptanceCriteria: [],
    labels: [],
  };
}
