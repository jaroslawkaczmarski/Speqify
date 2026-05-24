import { composeMarkdown } from "./format.js";
import { TrackerError, type GitlabConfig, type SubmitInput, type SubmitResult } from "./types.js";

export async function submitGitlab(
  config: GitlabConfig,
  input: SubmitInput,
): Promise<SubmitResult> {
  const base = (config.baseUrl?.trim() || "https://gitlab.com").replace(/\/$/, "");
  const res = await fetch(
    `${base}/api/v4/projects/${encodeURIComponent(config.projectId)}/issues`,
    {
      method: "POST",
      headers: { "private-token": config.token, "content-type": "application/json" },
      body: JSON.stringify({
        title: input.ticket.title,
        description: composeMarkdown(input.ticket, input.context),
        labels: input.ticket.labels.join(","),
      }),
    },
  );
  if (!res.ok) {
    throw new TrackerError(`GitLab rejected the issue: ${await errorText(res)}`, res.status);
  }
  const data = (await res.json()) as { id: number; iid: number; web_url: string };
  return { url: data.web_url, id: String(data.id), key: `#${data.iid}` };
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`;
}
