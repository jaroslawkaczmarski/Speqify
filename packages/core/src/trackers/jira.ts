import { composeAdf } from "./adf.js";
import { TrackerError, type JiraConfig, type SubmitInput, type SubmitResult } from "./types.js";

function hostOf(site: string): string {
  const s = site.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return s.includes(".") ? s : `${s}.atlassian.net`;
}

/** Jira labels may not contain spaces. */
function sanitizeLabels(labels: string[]): string[] {
  return labels.map((l) => l.trim().replace(/\s+/g, "-")).filter(Boolean);
}

export async function submitJira(config: JiraConfig, input: SubmitInput): Promise<SubmitResult> {
  const host = hostOf(config.site);
  const auth = btoa(`${config.email}:${config.token}`);
  const res = await fetch(`https://${host}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: config.projectKey },
        summary: input.ticket.title.slice(0, 254),
        issuetype: { name: config.issueType || "Task" },
        description: composeAdf(input.ticket, input.context),
        labels: sanitizeLabels(input.ticket.labels),
      },
    }),
  });
  if (!res.ok) {
    throw new TrackerError(`Jira rejected the issue: ${await errorText(res)}`, res.status);
  }
  const data = (await res.json()) as { id: string; key: string };
  return {
    url: `https://${host}/browse/${data.key}`,
    id: data.id,
    key: data.key,
  };
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`;
}
