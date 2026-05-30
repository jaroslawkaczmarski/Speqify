import { composeMarkdown } from "./format.js";
import { dataUrlToBlob, errorText, recordingName, screenshotName } from "./media.js";
import { isSafeEndpoint } from "../redact.js";
import { TrackerError, type GitlabConfig, type SubmitInput, type SubmitResult } from "./types.js";

export async function submitGitlab(
  config: GitlabConfig,
  input: SubmitInput,
): Promise<SubmitResult> {
  const base = (config.baseUrl?.trim() || "https://gitlab.com").replace(/\/$/, "");
  if (!isSafeEndpoint(base)) {
    throw new TrackerError(`Refusing to send your token to a non-HTTPS GitLab URL: ${base}`);
  }
  const warnings: string[] = [];
  let description = composeMarkdown(input.ticket, input.context);

  // Upload the screenshot + recording first, then reference them in the description.
  const shot = input.context?.screenshot;
  if (shot) {
    const blob = dataUrlToBlob(shot);
    const md = await uploadFile(base, config, blob, screenshotName(blob.type)).catch(() => null);
    if (md) description += `\n\n## Screenshot\n${md}`;
    else warnings.push("Screenshot upload failed.");
  }
  if (input.video) {
    const md = await uploadFile(base, config, input.video, recordingName(input.video.type)).catch(() => null);
    if (md) description += `\n\n## Screen recording\n${md}`;
    else warnings.push("Screen-recording upload failed.");
  }

  const res = await fetch(
    `${base}/api/v4/projects/${encodeURIComponent(config.projectId)}/issues`,
    {
      method: "POST",
      headers: { "private-token": config.token, "content-type": "application/json" },
      body: JSON.stringify({
        title: input.ticket.title,
        description,
        labels: input.ticket.labels.join(","),
      }),
    },
  );
  if (!res.ok) {
    throw new TrackerError(`GitLab rejected the issue: ${await errorText(res)}`, res.status);
  }
  const data = (await res.json()) as { id: number; iid: number; web_url: string };
  return { url: data.web_url, id: String(data.id), key: `#${data.iid}`, attachmentWarnings: warnings.length ? warnings : undefined };
}

/** Upload a file to the project; returns the markdown snippet GitLab gives back. */
async function uploadFile(base: string, config: GitlabConfig, blob: Blob, filename: string): Promise<string | null> {
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(`${base}/api/v4/projects/${encodeURIComponent(config.projectId)}/uploads`, {
    method: "POST",
    headers: { "private-token": config.token },
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { markdown?: string };
  return data.markdown ?? null;
}
