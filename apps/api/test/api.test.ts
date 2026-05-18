import type { Panel } from "@speqify/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/env.js";
import { hashPassword } from "../src/lib/crypto.js";
import { InMemoryRepository } from "../src/repo/memory.js";

const ENV_URL = "https://app.example.com";

function panel(token: string, status: "open" | "closed"): Panel {
  return {
    id: `panel-${token}`,
    projectId: "proj-1",
    audience: "client",
    secretToken: token,
    environmentUrl: ENV_URL,
    status,
    createdAt: new Date().toISOString(),
  };
}

function annotationBody(over: Record<string, unknown> = {}) {
  return {
    clientAnnotationId: "cli-1",
    submissionId: "sub-1",
    clientId: "browser-1",
    type: "element",
    pageUrl: `${ENV_URL}/checkout`,
    breadcrumb: [],
    element: null,
    screenshot: null,
    voice: null,
    recordingVideo: null,
    recordingAudio: null,
    textNote: "make this primary",
    structured: null,
    technical: null,
    hostApp: null,
    clientCreatedAt: new Date().toISOString(),
    ...over,
  };
}

let config: AppConfig;
let poHash: string;
beforeAll(async () => {
  config = {
    superAdminEmail: "admin@speqify.app",
    superAdminPasswordHash: await hashPassword("s3cret-pass"),
    sessionSecret: "test-session-secret",
  };
  poHash = await hashPassword("po-pass");
});

function makeApp(extra?: Panel[]) {
  const repo = new InMemoryRepository({
    panels: [panel("open-tok", "open"), panel("closed-tok", "closed"), ...(extra ?? [])],
    users: [
      {
        id: "usr_po",
        role: "product_owner",
        email: "po@speqify.app",
        displayName: "Demo PO",
        passwordHash: poHash,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  return { app: createApp({ repo, config }), repo };
}

async function login(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.request("/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return ((await res.json()) as { token: string }).token;
}

describe("health", () => {
  it("returns ok", async () => {
    const { app } = makeApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "speqify-api" });
  });
});

describe("admin auth", () => {
  it("rejects bad credentials with an error envelope", async () => {
    const { app } = makeApp();
    const res = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@speqify.app", password: "wrong" }),
    });
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string; correlationId: string } };
    expect(json.error.code).toBe("unauthorized");
    expect(json.error.correlationId).toBeTruthy();
  });

  it("issues a session that /admin/me accepts", async () => {
    const { app } = makeApp();
    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@speqify.app", password: "s3cret-pass" }),
    });
    expect(login.status).toBe(200);
    const { token, role } = (await login.json()) as { token: string; role: string };
    expect(role).toBe("superadmin");

    const me = await app.request("/admin/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);

    const noAuth = await app.request("/admin/me");
    expect(noAuth.status).toBe(401);
  });
});

describe("panel capability token", () => {
  it("404s an unknown token", async () => {
    const { app } = makeApp();
    expect((await app.request("/panels/nope")).status).toBe(404);
  });

  it("validates an open panel", async () => {
    const { app } = makeApp();
    const res = await app.request("/panels/open-tok");
    expect(res.status).toBe(200);
    expect((await res.json()) as { status: string }).toMatchObject({ status: "open" });
  });

  it("reports a closed panel but blocks ingest (panel_closed)", async () => {
    const { app } = makeApp();
    expect((await app.request("/panels/closed-tok")).status).toBe(200);
    const res = await app.request("/panels/closed-tok/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(annotationBody()),
    });
    expect(res.status).toBe(423);
  });
});

describe("annotation ingest", () => {
  it("is idempotent on clientAnnotationId", async () => {
    const { app } = makeApp();
    const first = await app.request("/panels/open-tok/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(annotationBody()),
    });
    expect(first.status).toBe(201);
    expect((await first.json()) as { created: boolean }).toMatchObject({ created: true });

    const second = await app.request("/panels/open-tok/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(annotationBody()),
    });
    expect(second.status).toBe(200);
    expect((await second.json()) as { created: boolean }).toMatchObject({ created: false });
  });

  it("400s an invalid body", async () => {
    const { app } = makeApp();
    const res = await app.request("/panels/open-tok/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(annotationBody({ pageUrl: "not-a-url" })),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("bad_request");
  });

  it("rejects a mismatched browser Origin (CORS allowlist)", async () => {
    const { app } = makeApp();
    const res = await app.request("/panels/open-tok/annotations", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.com" },
      body: JSON.stringify(annotationBody()),
    });
    expect(res.status).toBe(403);
  });
});

describe("submit", () => {
  it("404s an unknown submission and completes a known one", async () => {
    const { app } = makeApp();
    const missing = await app.request("/panels/open-tok/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ submissionId: "ghost", clientId: "browser-1" }),
    });
    expect(missing.status).toBe(404);

    await app.request("/panels/open-tok/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(annotationBody()),
    });
    const ok = await app.request("/panels/open-tok/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ submissionId: "sub-1", clientId: "browser-1" }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ complete: true });
  });
});

describe("superadmin (Phase 2)", () => {
  it("requires a superadmin session", async () => {
    const { app } = makeApp();
    expect((await app.request("/admin/projects")).status).toBe(401);

    const poToken = await login(app, "po@speqify.app", "po-pass");
    const asPo = await app.request("/admin/projects", {
      headers: { authorization: `Bearer ${poToken}` },
    });
    expect(asPo.status).toBe(401);
  });

  it("creates a PO, a project and a usable panel end to end", async () => {
    const { app } = makeApp();
    const sa = await login(app, "admin@speqify.app", "s3cret-pass");
    const auth = { authorization: `Bearer ${sa}`, "content-type": "application/json" };

    const userRes = await app.request("/admin/users", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ email: "newpo@speqify.app", displayName: "New PO" }),
    });
    expect(userRes.status).toBe(201);
    const created = (await userRes.json()) as { id: string; password: string };
    expect(created.password.length).toBeGreaterThanOrEqual(12);

    const dup = await app.request("/admin/users", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ email: "newpo@speqify.app", displayName: "Dup" }),
    });
    expect(dup.status).toBe(409);

    const users = await app.request("/admin/users", {
      headers: { authorization: `Bearer ${sa}` },
    });
    const userList = ((await users.json()) as { users: { email: string }[] }).users;
    expect(userList.some((u) => u.email === "newpo@speqify.app")).toBe(true);
    expect(userList.every((u) => !("passwordHash" in u))).toBe(true);

    const projRes = await app.request("/admin/projects", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        name: "Acme App",
        productOwnerId: created.id,
        environmentUrls: ["https://staging.acme.test"],
      }),
    });
    expect(projRes.status).toBe(201);
    const project = (await projRes.json()) as { id: string };

    const list = await app.request("/admin/projects", {
      headers: { authorization: `Bearer ${sa}` },
    });
    expect(((await list.json()) as { projects: unknown[] }).projects).toHaveLength(1);

    const panelRes = await app.request(`/admin/projects/${project.id}/panels`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ audience: "client", environmentUrl: "https://staging.acme.test" }),
    });
    expect(panelRes.status).toBe(201);
    const panel = (await panelRes.json()) as { secretToken: string; panelUrl: string };
    expect(panel.panelUrl).toContain(panel.secretToken);

    // The admin-created token works on the public SDK route.
    const validate = await app.request(`/panels/${panel.secretToken}`);
    expect(validate.status).toBe(200);
    expect((await validate.json()) as { status: string }).toMatchObject({ status: "open" });
  });
});
