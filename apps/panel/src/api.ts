/** API client for the SA/PO panel. Bearer token in sessionStorage. */
import type {
  AdminStats,
  AuditEntry,
  Panel,
  PlatformProviderConfigView,
  PoSourceAnnotation,
  Project,
  ProjectStatus,
  ProjectTemplate,
  Task,
  TaskEditInput,
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
    template: ProjectTemplate;
  };
  export: {
    target: string;
    fieldMapping: Record<string, string>;
    defaults: Record<string, string>;
  } | null;
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
    template?: ProjectTemplate,
  ) =>
    call<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
        productOwnerId,
        environmentUrls,
        ...(template ? { template } : {}),
      }),
    }),
  listPanels: (projectId: string) =>
    call<{ panels: Panel[] }>(`/admin/projects/${projectId}/panels`),
  createPanel: (projectId: string, audience: string, environmentUrl: string) =>
    call<{ id: string; secretToken: string; panelUrl: string }>(
      `/admin/projects/${projectId}/panels`,
      { method: "POST", body: JSON.stringify({ audience, environmentUrl }) },
    ),
  setPanelStatus: (panelId: string, status: "open" | "closed") =>
    call<{ id: string; status: string }>(`/admin/panels/${panelId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  deletePanel: (panelId: string) =>
    call<{ deleted: boolean }>(`/admin/panels/${panelId}`, { method: "DELETE" }),
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
  putTemplate: (template: ProjectTemplate) =>
    call<Project>("/po/project/template", {
      method: "PUT",
      body: JSON.stringify(template),
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

/** SDK loader snippet for a panel (Install tab, IMPLEMENTATION_PLAN §7.3). */
export function sdkSnippet(secretToken: string): string {
  return [
    "<!-- Speqify overlay - load ONLY on non-production / review envs -->",
    "<script",
    "  defer",
    '  src="https://speqify.app/sdk/v1/loader.js"',
    `  data-speqify-token="${secretToken}"`,
    "></script>",
  ].join("\n");
}
