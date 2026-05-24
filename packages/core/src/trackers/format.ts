import type { CaptureContext } from "../capture.js";
import type { Ticket } from "../ticket.js";

/** Compose a Markdown issue body (GitHub, GitLab, Linear). */
export function composeMarkdown(ticket: Ticket, context?: CaptureContext): string {
  const parts: string[] = [];
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
  const lines: string[] = [];
  lines.push(`- **URL:** ${context.page.url}`);
  lines.push(`- **User agent:** ${context.page.userAgent}`);
  if (context.element) lines.push(`- **Element:** \`${context.element.selector}\``);

  const errors = context.errors.slice(-10);
  if (errors.length) {
    lines.push("", "**JS errors**", "```");
    for (const e of errors) lines.push(e.stack ? `${e.message}\n${e.stack}` : e.message);
    lines.push("```");
  }
  const failed = context.network.filter((n) => !n.ok).slice(-10);
  if (failed.length) {
    lines.push("", "**Failed requests**", "```");
    for (const n of failed) lines.push(`${n.status} ${n.method} ${n.url}`);
    lines.push("```");
  }
  const consoleErr = context.console
    .filter((c) => c.level === "error" || c.level === "warn")
    .slice(-10);
  if (consoleErr.length) {
    lines.push("", "**Console**", "```");
    for (const c of consoleErr) lines.push(`[${c.level}] ${c.message}`);
    lines.push("```");
  }
  return ["<details><summary>Technical context</summary>", "", ...lines, "</details>"].join("\n");
}
