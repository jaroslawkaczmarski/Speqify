/** API client for the SA/PO panel. Bearer token in sessionStorage. */
import type {
  AdminStats,
  AuditEntry,
  PlatformProviderConfigView,
  PoSourceAnnotation,
  Project,
  ProjectStatus,
  ProjectTemplate,
  ProjectTemplates,
  Reviewer,
  ReviewerView,
  ReviewSession,
  ReviewSessionStatus,
  Task,
  TaskEditInput,
  TaskType,
  User,
} from "@speqify/shared";

const API_BASE =
  (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? "http://127.0.0.1:8787";

const TOKEN_KEY = "speqify.token";

export const auth = {
  get: (): string | null => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = auth.get();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? (data as { error: { message: string } }).error.message
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export interface PoProjectView {
  project: {
    id: string;
    name: string;
    environmentUrls: string[];
    templates: ProjectTemplates;
  };
  export: {
    target: string;
    fieldMapping: Record<string, string>;
    defaults: Record<string, string>;
  } | null;
}

export interface CreateReviewSessionBody {
  name: string;
  description?: string;
  instructions?: string;
  envUrl: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface InviteReviewerResponse {
  reviewer: ReviewerView;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
}

export const api = {
  login: (email: string, password: string) =>
    call<{ token: string; role: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => call<{ sub: string; role: string; exp: number }>("/admin/me"),

  // SuperAdmin
  listUsers: () => call<{ users: User[] }>("/admin/users"),
  createUser: (email: string, displayName: string) =>
    call<{ id: string; email: string; password: string }>("/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, displayName }),
    }),
  listProjects: () => call<{ projects: Project[] }>("/admin/projects"),
  createProject: (
    name: string,
    productOwnerId: string,
    environmentUrls: string[],
    templates?: ProjectTemplates,
  ) =>
    call<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
        productOwnerId,
        environmentUrls,
        ...(templates ? { templates } : {}),
      }),
    }),

  // Review sessions (PO-scoped; SA can target by ?projectId= -- enforced on
  // the API side via resolvePoProject + ownership check).
  listSessions: (_projectId: string) => call<{ sessions: ReviewSession[] }>(`/po/sessions`),
  createSession: (_projectId: string, body: CreateReviewSessionBody) =>
    call<ReviewSession>(`/po/sessions`, {
      method: "POST",
      body: JSON.stringify({
        ...body,
        description: body.description ?? "",
        instructions: body.instructions ?? "",
        startsAt: body.startsAt ?? null,
        endsAt: body.endsAt ?? null,
      }),
    }),
  getSession: (sessionId: string) =>
    call<{ session: ReviewSession; reviewers: ReviewerView[] }>(`/po/sessions/${sessionId}`),
  updateSession: (sessionId: string, body: Partial<CreateReviewSessionBody>) =>
    call<ReviewSession>(`/po/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  setSessionStatus: (sessionId: string, status: ReviewSessionStatus) =>
    call<{ id: string; status: string }>(`/po/sessions/${sessionId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  inviteReviewer: (sessionId: string, name: string, email: string) =>
    call<InviteReviewerResponse>(`/po/sessions/${sessionId}/reviewers`, {
      method: "POST",
      body: JSON.stringify({ name, email }),
    }),
  revokeReviewer: (sessionId: string, reviewerId: string) =>
    call<{ id: string; status: string }>(
      `/po/sessions/${sessionId}/reviewers/${reviewerId}`,
      { method: "DELETE" },
    ),
  resendInvite: (sessionId: string, reviewerId: string) =>
    call<{ inviteUrl: string; emailSent: boolean; emailError?: string }>(
      `/po/sessions/${sessionId}/reviewers/${reviewerId}/resend`,
      { method: "POST" },
    ),

  adminStats: () => call<AdminStats>("/admin/stats"),
  adminAudit: () => call<{ entries: AuditEntry[] }>("/admin/audit"),
  setProjectStatus: (projectId: string, status: ProjectStatus) =>
    call<{ id: string; status: string }>(`/admin/projects/${projectId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  getProviders: () => call<{ config: PlatformProviderConfigView | null }>("/admin/providers"),
  putProviders: (body: {
    aiProvider: string;
    aiModel: string;
    aiEndpoint?: string;
    aiKey?: string;
    transcriptionProvider: string;
    transcriptionEndpoint?: string;
  }) =>
    call<{ config: PlatformProviderConfigView }>("/admin/providers", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Product Owner
  poProject: () => call<PoProjectView>("/po/project"),
  /** Update a single task-type template tab. */
  putTemplate: (taskType: TaskType, template: ProjectTemplate) =>
    call<Project>("/po/project/templates", {
      method: "PUT",
      body: JSON.stringify({ taskType, template }),
    }),
  /** Replace the full per-type template bundle in one call. */
  putTemplates: (templates: ProjectTemplates) =>
    call<Project>("/po/project/templates", {
      method: "PUT",
      body: JSON.stringify(templates),
    }),
  putExport: (body: {
    target: string;
    credentials?: Record<string, string>;
    fieldMapping?: Record<string, string>;
    defaults?: Record<string, string>;
  }) =>
    call<{ configured: boolean; target: string }>("/po/project/export", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testExport: () =>
    call<{ ok: boolean; target: string; checks: { name: string; ok: boolean }[] }>(
      "/po/project/export/test",
      { method: "POST" },
    ),
  analyze: () =>
    call<{ status: string; annotations: number; tasksCreated: number }>("/po/analyze", {
      method: "POST",
    }),
  listTasks: () => call<{ tasks: Task[] }>("/po/tasks"),
  getTask: (id: string) => call<{ task: Task }>(`/po/tasks/${id}`),
  taskAnnotations: (id: string) =>
    call<{ annotations: PoSourceAnnotation[] }>(`/po/tasks/${id}/annotations`),
  acceptTask: (id: string, expectedRev: number) =>
    call<{ task: Task }>(`/po/tasks/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({ expectedRev }),
    }),
  rejectTask: (id: string, expectedRev: number, reason?: string) =>
    call<{ task: Task }>(`/po/tasks/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ expectedRev, reason }),
    }),
  regenerateTask: (id: string, expectedRev: number) =>
    call<{ task: Task }>(`/po/tasks/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ expectedRev }),
    }),
  editTask: (id: string, input: TaskEditInput) =>
    call<{ task: Task }>(`/po/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  exportTasks: (format: "json" | "csv") =>
    call<{
      format: string;
      total: number;
      newlyExported: number;
      filename: string;
      content: string;
    }>(`/po/tasks/export?format=${format}`, { method: "POST" }),
};

// Re-export for convenience in pages-* (they previously imported Reviewer/Session
// through api.ts indirectly via Panel).
export type { Reviewer, ReviewerView, ReviewSession };
