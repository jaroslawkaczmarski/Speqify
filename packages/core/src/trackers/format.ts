import { describeStep, selectContextHighlights } from "../ai/enhance.js";
import { redactUrl } from "../redact.js";
import type { CaptureContext } from "../capture.js";
import type { Ticket } from "../ticket.js";

/** Compose a Markdown issue body (GitHub, GitLab, Linear). */
export function composeMarkdown(ticket: Ticket, context?: CaptureContext): string {
  const parts: string[] = [];
  // Lead with where it happened — the exact URL of the page being filed about.
  const url = context?.page.url?.trim();
  if (url) parts.push(`**Where it happened:** ${redactUrl(url)}`);
  if (ticket.description.trim()) parts.push(ticket.description.trim());

  if (ticket.stepsToReproduce.length) {
    parts.push(
      ["## Steps to reproduce", ...ticket.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`)].join(
        "\n",
      ),
    );
  }
  if (ticket.acceptanceCriteria.length) {
    parts.push(
      ["## Acceptance criteria", ...ticket.acceptanceCriteria.map((s) => `- [ ] ${s}`)].join("\n"),
    );
  }
  const tech = technicalMarkdown(context);
  if (tech) parts.push(tech);
  parts.push("\n<sub>Filed with Speqify</sub>");
  return parts.join("\n\n");
}

function technicalMarkdown(context?: CaptureContext): string {
  if (!context) return "";
  const h = selectContextHighlights(context);
  const lines: string[] = [];
  lines.push(`- **URL:** ${h.pageUrl}`);
  lines.push(`- **User agent:** ${context.page.userAgent}`);
  if (h.element) lines.push(`- **Element:** \`${h.element}\``);

  if (h.jsErrors.length) {
    lines.push("", "**JS errors**", "```");
    for (const e of h.jsErrors) lines.push(e.stack ? `${e.message}\n${e.stack}` : e.message);
    lines.push("```");
  }
  if (h.failedRequests.length) {
    lines.push("", "**Failed requests**", "```");
    for (const n of h.failedRequests) lines.push(`${n.status} ${n.method} ${n.url}`);
    lines.push("```");
  }
  if (h.consoleErrors.length) {
    lines.push("", "**Console**", "```");
    for (const c of h.consoleErrors) lines.push(`[${c.level}] ${c.message}`);
    lines.push("```");
  }
  if (h.steps.length) {
    lines.push("", "**Observed steps**");
    h.steps.forEach((s, i) => lines.push(`${i + 1}. ${describeStep(s)}`));
  }
  return ["<details><summary>Technical context</summary>", "", ...lines, "</details>"].join("\n");
}
