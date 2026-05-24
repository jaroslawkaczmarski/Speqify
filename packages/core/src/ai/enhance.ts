import { TicketSchema, type Ticket } from "../ticket.js";
import type { CaptureContext } from "../capture.js";
import { callModel } from "./providers.js";
import { AiError, type AiSettings } from "./types.js";

const SYSTEM = `You are a senior product engineer who turns rough notes into clear, actionable issue tracker tickets.
Given a user's raw note and optional technical context captured from the page, produce ONE well-structured ticket.

Rules:
- Write a concise, specific title (no ticket-type prefix).
- Write the description in clear Markdown: the problem/request, impact, and relevant context.
- If it's a defect, fill stepsToReproduce with concrete ordered steps. Otherwise leave it empty.
- Fill acceptanceCriteria with verifiable, testable bullet points.
- Classify "type" as one of: bug, feature, task, improvement.
- Set "priority" (low|medium|high|urgent) only if the note clearly implies urgency; otherwise null.
- Suggest a few relevant lowercase "labels".
- Use the captured console/network errors to make the ticket precise, but do NOT dump raw logs into the body.
- Respond with ONLY a JSON object matching the schema. No prose, no code fences.`;

const SCHEMA_HINT = `JSON schema:
{
  "title": string,
  "description": string (markdown),
  "type": "bug" | "feature" | "task" | "improvement",
  "priority": "low" | "medium" | "high" | "urgent" | null,
  "stepsToReproduce": string[],
  "acceptanceCriteria": string[],
  "labels": string[]
}`;

export function buildContextDigest(ctx?: CaptureContext): string {
  if (!ctx) return "";
  const lines: string[] = [];
  lines.push(`Page: ${ctx.page.title || "(untitled)"} — ${ctx.page.url}`);
  if (ctx.element) lines.push(`Selected element: ${ctx.element.selector}`);
  const errors = ctx.errors.slice(-8);
  if (errors.length) {
    lines.push("JS errors:");
    for (const e of errors) lines.push(`  - ${e.message}`);
  }
  const consoleErrors = ctx.console.filter((c) => c.level === "error" || c.level === "warn").slice(-8);
  if (consoleErrors.length) {
    lines.push("Console:");
    for (const c of consoleErrors) lines.push(`  - [${c.level}] ${c.message}`);
  }
  const failed = ctx.network.filter((n) => !n.ok).slice(-8);
  if (failed.length) {
    lines.push("Failed network requests:");
    for (const n of failed) lines.push(`  - ${n.status} ${n.method} ${n.url}`);
  }
  return lines.join("\n");
}

/** Extract a JSON object from a model reply that may be fenced or padded with prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new AiError("AI did not return valid JSON");
  }
}

export interface EnhanceInput {
  note: string;
  context?: CaptureContext;
  settings: AiSettings;
}

/** Turn a rough note (+ optional captured context) into a structured Ticket. */
export async function enhanceTicket({ note, context, settings }: EnhanceInput): Promise<Ticket> {
  if (!note.trim() && !context) throw new AiError("Nothing to enhance — write a note first.");

  const digest = buildContextDigest(context);
  const user = [
    SCHEMA_HINT,
    "",
    "User note:",
    note.trim() || "(no note — infer from the captured context)",
    digest ? `\nCaptured context:\n${digest}` : "",
  ].join("\n");

  const raw = await callModel(settings, { system: SYSTEM, user, temperature: 0.3 });
  const json = extractJson(raw);
  const parsed = TicketSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiError(`AI output did not match the ticket schema: ${parsed.error.message}`);
  }
  return parsed.data;
}
