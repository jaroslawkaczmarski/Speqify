import { composeMarkdown } from "./format.js";
import { TrackerError, type GithubConfig, type SubmitInput, type SubmitResult } from "./types.js";

export async function submitGithub(
  config: GithubConfig,
  input: SubmitInput,
): Promise<SubmitResult> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: input.ticket.title,
        body: composeMarkdown(input.ticket, input.context),
        labels: input.ticket.labels,
      }),
    },
  );
  if (!res.ok) {
    throw new TrackerError(`GitHub rejected the issue: ${await errorText(res)}`, res.status);
  }
  const data = (await res.json()) as { id: number; number: number; html_url: string };
  return { url: data.html_url, id: String(data.id), key: `#${data.number}` };
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`;
}
