import { describeStep, selectContextHighlights } from "../ai/enhance.js";
import { redactUrl } from "../redact.js";
import type { CaptureContext } from "../capture.js";
import type { Ticket } from "../ticket.js";

/** Minimal Atlassian Document Format node graph. */
interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function text(value: string): AdfNode {
  return { type: "text", text: value };
}
function paragraph(value: string): AdfNode {
  return { type: "paragraph", content: value ? [text(value)] : [] };
}
function heading(value: string): AdfNode {
  return { type: "heading", attrs: { level: 2 }, content: [text(value)] };
}
function listItem(value: string): AdfNode {
  return { type: "listItem", content: [paragraph(value)] };
}
function codeBlock(value: string): AdfNode {
  return { type: "codeBlock", attrs: { language: "text" }, content: [text(value)] };
}

/** Build a Jira ADF description document from a Ticket (+ optional context). */
export function composeAdf(ticket: Ticket, context?: CaptureContext): AdfNode {
  const content: AdfNode[] = [];

  // Lead with where it happened — the exact URL of the page being filed about.
  const url = context?.page.url?.trim();
  if (url) {
    const safe = redactUrl(url);
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Where it happened: " },
        { type: "text", text: safe, marks: [{ type: "link", attrs: { href: safe } }] },
      ],
    });
  }

  for (const block of ticket.description.split(/\n{2,}/)) {
    const t = block.trim();
    if (t) content.push(paragraph(t));
  }

  if (ticket.stepsToReproduce.length) {
    content.push(heading("Steps to reproduce"));
    content.push({ type: "orderedList", content: ticket.stepsToReproduce.map(listItem) });
  }
  if (ticket.acceptanceCriteria.length) {
    content.push(heading("Acceptance criteria"));
    content.push({ type: "bulletList", content: ticket.acceptanceCriteria.map(listItem) });
  }

  const tech = technicalText(context);
  if (tech) {
    content.push(heading("Technical context"));
    content.push(codeBlock(tech));
  }

  if (content.length === 0) content.push(paragraph(""));
  return { type: "doc", attrs: { version: 1 }, content, version: 1 } as AdfNode & {
    version: number;
  };
}

function technicalText(context?: CaptureContext): string {
  if (!context) return "";
  const h = selectContextHighlights(context);
  const lines: string[] = [`URL: ${h.pageUrl}`, `UA: ${context.page.userAgent}`];
  if (h.element) lines.push(`Element: ${h.element}`);
  for (const e of h.jsErrors) lines.push(`JS error: ${e.message}`);
  for (const n of h.failedRequests) lines.push(`HTTP ${n.status} ${n.method} ${n.url}`);
  for (const c of h.consoleErrors) lines.push(`console.${c.level}: ${c.message}`);
  if (h.steps.length) {
    lines.push("Observed steps:");
    h.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${describeStep(s)}`));
  }
  return lines.join("\n");
}
