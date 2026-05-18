/** Thin API client for the SA/PO panel. Bearer token kept in sessionStorage. */
import type { Panel, Project, User } from "@speqify/shared";

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

export const api = {
  login: (email: string, password: string) =>
    call<{ token: string; role: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => call<{ sub: string; role: string; exp: number }>("/admin/me"),
  listUsers: () => call<{ users: User[] }>("/admin/users"),
  createUser: (email: string, displayName: string) =>
    call<{ id: string; email: string; password: string }>("/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, displayName }),
    }),
  listProjects: () => call<{ projects: Project[] }>("/admin/projects"),
  createProject: (name: string, productOwnerId: string, environmentUrls: string[]) =>
    call<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify({ name, productOwnerId, environmentUrls }),
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
