import { composeMarkdown } from "./format.js";
import { dataUrlToBlob, recordingName, screenshotName } from "./media.js";
import type { Ticket } from "../ticket.js";
import { TrackerError, type LinearConfig, type SubmitInput, type SubmitResult } from "./types.js";

const MUTATION = `mutation Create($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;

const FILE_UPLOAD = `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
  fileUpload(contentType: $contentType, filename: $filename, size: $size) {
    success
    uploadFile { uploadUrl assetUrl headers { key value } }
  }
}`;

/** Linear priority: 0 none, 1 urgent, 2 high, 3 normal, 4 low. */
function priorityValue(ticket: Ticket): number | undefined {
  switch (ticket.priority) {
    case "urgent":
      return 1;
    case "high":
      return 2;
    case "medium":
      return 3;
    case "low":
      return 4;
    default:
      return undefined;
  }
}

export async function submitLinear(
  config: LinearConfig,
  input: SubmitInput,
): Promise<SubmitResult> {
  const warnings: string[] = [];
  let description = composeMarkdown(input.ticket, input.context);
  const shot = input.context?.screenshot;
  if (shot) {
    const blob = dataUrlToBlob(shot);
    const assetUrl = await uploadFile(config, blob, screenshotName(blob.type)).catch(() => null);
    if (assetUrl) description += `\n\n## Screenshot\n![screenshot](${assetUrl})`;
    else warnings.push("Screenshot upload failed.");
  }
  if (input.video) {
    const assetUrl = await uploadFile(config, input.video, recordingName(input.video.type)).catch(() => null);
    if (assetUrl) description += `\n\n## Screen recording\n[${recordingName(input.video.type)}](${assetUrl})`;
    else warnings.push("Screen-recording upload failed.");
  }

  const variables: { input: Record<string, unknown> } = {
    input: {
      teamId: config.teamId,
      title: input.ticket.title,
      description,
    },
  };
  const priority = priorityValue(input.ticket);
  if (priority !== undefined) variables.input.priority = priority;

  // Linear requires no "Bearer" prefix on the personal API key.
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: config.apiKey, "content-type": "application/json" },
    body: JSON.stringify({ query: MUTATION, variables }),
  });
  if (!res.ok) {
    throw new TrackerError(`Linear rejected the issue: ${await errorText(res)}`, res.status);
  }
  const data = (await res.json()) as {
    data?: { issueCreate?: { success: boolean; issue?: { id: string; identifier: string; url: string } } };
    errors?: { message: string }[];
  };
  if (data.errors?.length) {
    throw new TrackerError(`Linear error: ${data.errors.map((e) => e.message).join("; ")}`);
  }
  const issue = data.data?.issueCreate?.issue;
  if (!data.data?.issueCreate?.success || !issue) {
    throw new TrackerError("Linear did not create the issue");
  }
  return { url: issue.url, id: issue.id, key: issue.identifier, attachmentWarnings: warnings.length ? warnings : undefined };
}

/** Request a signed URL from Linear, PUT the file to it, return the public asset URL. */
async function uploadFile(config: LinearConfig, blob: Blob, filename: string): Promise<string | null> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: config.apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      query: FILE_UPLOAD,
      variables: { contentType: blob.type, filename, size: blob.size },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: {
      fileUpload?: {
        success: boolean;
        uploadFile?: { uploadUrl: string; assetUrl: string; headers: { key: string; value: string }[] };
      };
    };
  };
  const file = data.data?.fileUpload?.uploadFile;
  if (!data.data?.fileUpload?.success || !file) return null;

  const headers: Record<string, string> = { "content-type": blob.type };
  for (const h of file.headers) headers[h.key] = h.value;
  const put = await fetch(file.uploadUrl, { method: "PUT", headers, body: blob });
  return put.ok ? file.assetUrl : null;
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`;
}
