import { buildContextDigest, type CaptureContext, type TicketType } from "@speqify/core";

export interface DraftOptions {
  /** Target language for the ticket body. "off"/"auto"/empty = keep source language. */
  translateTo?: string;
  /** When false, the model is told to leave labels empty. */
  autoLabels?: boolean;
  /** Per-type description skeletons; the model fills the one matching the type it picks. */
  templates?: Partial<Record<TicketType, string>>;
}

export function buildDraftSystem(opts: DraftOptions = {}): string {
  const labelRule = opts.autoLabels
    ? `- Suggest a few short lowercase "labels".`
    : `- Leave "labels" as an empty array (the user disabled auto-labels).`;
  return `You are a senior product engineer. Turn a spoken note and optional page context into ONE well-structured issue tracker ticket.

Rules:
- Write a concise, specific title (no type prefix).
- Classify "type" as one of: bug, feature, task, improvement.
- Write the description in clear Markdown. If a template for the chosen type is provided in the user message, follow its section headings and fill each section from the note and context; otherwise write the problem/request, impact, and relevant context.
${labelRule}
- Use captured console/network errors and reproduction steps to be precise; do NOT dump raw logs.
- Respond with ONLY a JSON object: {"title": string, "description": string, "type": "bug"|"feature"|"task"|"improvement", "labels": string[]}. No prose, no code fences.`;
}

function templatesBlock(templates?: Partial<Record<TicketType, string>>): string {
  if (!templates) return "";
  const entries = (Object.entries(templates) as [TicketType, string | undefined][]).filter(
    ([, body]) => body && body.trim(),
  );
  if (!entries.length) return "";
  const lines = entries.map(([type, body]) => `### ${type}\n${(body ?? "").trim()}`);
  return ["", "Description templates by type — use the one matching the type you assign:", ...lines].join("\n");
}

export function buildDraftUser(
  transcript: string,
  ctx?: CaptureContext,
  opts: DraftOptions = {},
): string {
  const digest = buildContextDigest(ctx);
  const translate =
    opts.translateTo && opts.translateTo !== "off" && opts.translateTo !== "auto"
      ? `Write the ticket in this language: ${opts.translateTo}.`
      : "";
  return [
    translate,
    "Spoken note:",
    transcript.trim() || "(no speech captured — infer from the context)",
    digest ? `\nCaptured context:\n${digest}` : "",
    templatesBlock(opts.templates),
  ]
    .filter(Boolean)
    .join("\n");
}
