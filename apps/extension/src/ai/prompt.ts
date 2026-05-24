import { buildContextDigest, type CaptureContext } from "@speqify/core";

export const DRAFT_SYSTEM = `You are a senior product engineer. Turn a spoken note and optional page context into ONE well-structured issue tracker ticket.

Rules:
- Write a concise, specific title (no type prefix).
- Write the description in clear Markdown: the problem/request, impact, and relevant context.
- Classify "type" as one of: bug, feature, task, improvement.
- Suggest a few short lowercase "labels".
- Use captured console/network errors to be precise; do NOT dump raw logs.
- Respond with ONLY a JSON object: {"title": string, "description": string, "type": "bug"|"feature"|"task"|"improvement", "labels": string[]}. No prose, no code fences.`;

export function buildDraftUser(transcript: string, ctx?: CaptureContext, translateTo?: string): string {
  const digest = buildContextDigest(ctx);
  return [
    translateTo && translateTo !== "off" ? `Write the ticket in this language: ${translateTo}.` : "",
    "Spoken note:",
    transcript.trim() || "(no speech captured — infer from the context)",
    digest ? `\nCaptured context:\n${digest}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
