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
beforeAll(async () => {
  config = {
    superAdminEmail: "admin@speqify.app",
    superAdminPasswordHash: await hashPassword("s3cret-pass"),
    sessionSecret: "test-session-secret",
  };
});

function makeApp(extra?: Panel[]) {
  const repo = new InMemoryRepository({
    panels: [panel("open-tok", "open"), panel("closed-tok", "closed"), ...(extra ?? [])],
  });
  return { app: createApp({ repo, config }), repo };
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
