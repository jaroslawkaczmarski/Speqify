import { composeMarkdown } from "./format.js";
import type { Ticket } from "../ticket.js";
import { TrackerError, type LinearConfig, type SubmitInput, type SubmitResult } from "./types.js";

const MUTATION = `mutation Create($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
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
  const variables: { input: Record<string, unknown> } = {
    input: {
      teamId: config.teamId,
      title: input.ticket.title,
      description: composeMarkdown(input.ticket, input.context),
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
  return { url: issue.url, id: issue.id, key: issue.identifier };
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`;
}
