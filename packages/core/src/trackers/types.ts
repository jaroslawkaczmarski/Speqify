import type { CaptureContext } from "../capture.js";
import type { Ticket } from "../ticket.js";

export type TrackerKind = "github" | "jira" | "linear" | "gitlab";

export interface GithubConfig {
  kind: "github";
  token: string;
  owner: string;
  repo: string;
}

export interface JiraConfig {
  kind: "jira";
  /** e.g. "your-team" for your-team.atlassian.net, or a full host. */
  site: string;
  email: string;
  token: string;
  projectKey: string;
  issueType: string;
}

export interface LinearConfig {
  kind: "linear";
  apiKey: string;
  teamId: string;
}

export interface GitlabConfig {
  kind: "gitlab";
  /** Defaults to https://gitlab.com */
  baseUrl?: string;
  token: string;
  /** URL-encoded "group/project" path or numeric id. */
  projectId: string;
}

export type TrackerConfig = GithubConfig | JiraConfig | LinearConfig | GitlabConfig;

export interface SubmitResult {
  /** Web URL of the created issue. */
  url: string;
  /** Tracker-native id. */
  id: string;
  /** Human key where applicable (e.g. "PROJ-123", "#42"). */
  key?: string;
  /** Non-fatal warnings — e.g. a screenshot/recording upload failed after the issue was created. */
  attachmentWarnings?: string[];
}

export interface SubmitInput {
  ticket: Ticket;
  context?: CaptureContext;
  /** The recorded screen+voice webm, attached where the tracker supports uploads. */
  video?: Blob | null;
}

export class TrackerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TrackerError";
  }
}

export const TRACKER_LABELS: Record<TrackerKind, string> = {
  github: "GitHub Issues",
  jira: "Jira",
  linear: "Linear",
  gitlab: "GitLab",
};
