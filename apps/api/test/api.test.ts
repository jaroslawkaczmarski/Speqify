import type { Annotation, Project, Reviewer, ReviewSession, Task } from "@speqify/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { NoopEmailSender } from "../src/email/resend.js";
import type { AppConfig } from "../src/env.js";
import { hashPassword } from "../src/lib/crypto.js";
import type { LlmProvider } from "../src/analysis/types.js";
import { InMemoryMediaStore } from "../src/media/memory.js";
import { InMemoryRepository } from "../src/repo/memory.js";
import type { Transcriber } from "../src/transcribe/types.js";

const ENV_URL = "https://app.example.com";

const baseTemplate = {
  language: "en" as const,
  userStory: true,
  acceptanceCriteria: true,
  labels: [],
  components: [],
  versions: [],
  customFields: {},
};
const defaultTemplates = {
  bug: baseTemplate,
  change: baseTemplate,
  feature: baseTemplate,
  polish: baseTemplate,
};

const ts = (): string => new Date().toISOString();

function reviewSession(
  id: string,
  token: string,
  projectId: string,
  status: ReviewSession["status"],
): ReviewSession {
  return {
    id,
    projectId,
    name: `Session ${id}`,
    description: "",
    instructions: "",
    envUrl: ENV_URL,
    token,
    status,
    startsAt: null,
    endsAt: null,
    createdBy: "usr_sa",
    createdAt: ts(),
  };
}

function reviewer(id: string, sessionId: string, token: string): Reviewer {
  return {
    id,
    sessionId,
    name: "Reviewer",
    email: "rev@example.com",
    token,
    status: "active",
    invitedAt: ts(),
    acceptedAt: ts(),
    lastSeenAt: null,
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
    clientCreatedAt: ts(),
    ...over,
  };
}

function sdkHeaders(sessionToken: string, reviewerToken: string) {
  return {
    "content-type": "application/json",
    "x-speqify-session": sessionToken,
    "x-speqify-reviewer": reviewerToken,
  };
}

let config: AppConfig;
let poHash: string;
beforeAll(async () => {
  config = {
    superAdminEmail: "admin@speqify.app",
    superAdminPasswordHash: await hashPassword("s3cret-pass"),
    sessionSecret: "test-session-secret",
    envelopeKey: "zHuQuTjauJQTlfnNRsm8vtB3GxPm5PmqK_sTqHM9e1A",
    panelOrigins: ["http://localhost:5174"],
  };
  poHash = await hashPassword("po-pass");
});

const poProject: Project = {
  id: "prj_po",
  name: "PO Project",
  productOwnerId: "usr_po",
  environmentUrls: ["https://staging.test", ENV_URL],
  status: "live",
  templates: defaultTemplates,
  exportConfigId: null,
  createdAt: ts(),
};

// "proj-1" host: separate from the PO's own project, used for the open/closed
// session smoke tests so /po routes are scoped only to prj_po.
const otherProject: Project = {
  id: "proj-1",
  name: "Other Project",
  productOwnerId: "usr_other",
  environmentUrls: [ENV_URL],
  status: "live",
  templates: defaultTemplates,
  exportConfigId: null,
  createdAt: ts(),
};

const openSession = reviewSession("sess-open", "open-tok", "proj-1", "live");
const closedSession = reviewSession("sess-closed", "closed-tok", "proj-1", "closed");
const poSession = reviewSession("sess-po", "po-tok", "prj_po", "live");

const openReviewer = reviewer("rev-open", openSession.id, "open-rev");
const closedReviewer = reviewer("rev-closed", closedSession.id, "closed-rev");
const poReviewer = reviewer("rev-po", poSession.id, "po-rev");

function makeApp(
  extra?: { sessions?: ReviewSession[]; reviewers?: Reviewer[] },
  transcriberArg?: Transcriber,
  llmArg?: LlmProvider,
) {
  const repo = new InMemoryRepository({
    reviewSessions: [openSession, closedSession, poSession, ...(extra?.sessions ?? [])],
    reviewers: [openReviewer, closedReviewer, poReviewer, ...(extra?.reviewers ?? [])],
    users: [
      {
        id: "usr_po",
        role: "product_owner",
        email: "po@speqify.app",
        displayName: "Demo PO",
        passwordHash: poHash,
        createdAt: ts(),
      },
    ],
    projects: [poProject, otherProject],
  });
  const mediaStore = new InMemoryMediaStore();
  const transcriber: Transcriber = transcriberArg ?? okTranscriber();
  const llm: LlmProvider = llmArg ?? okLlm();
  return {
    app: createApp({
      repo,
      config,
      mediaStore,
      transcriber,
      llm,
      emailSender: new NoopEmailSender(),
    }),
    repo,
    mediaStore,
  };
}

function okTranscriber(text = "the transcribed text"): Transcriber {
  return { transcribe: async () => ({ text }) };
}

function okLlm(json = '{"tasks":[{"title":"Improve checkout CTA"}]}'): LlmProvider {
  return { complete: async () => json };
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

describe("SDK session+reviewer token pair", () => {
  it("404s an unknown session token on intro", async () => {
    const { app } = makeApp();
    expect((await app.request("/sdk/sessions/nope/intro?reviewer=open-rev")).status).toBe(404);
  });

  it("rejects a missing reviewer token", async () => {
    const { app } = makeApp();
    expect((await app.request("/sdk/sessions/open-tok/intro")).status).toBe(401);
  });

  it("rejects a reviewer that does not belong to the session", async () => {
    const { app } = makeApp();
    // closed-rev is bound to sess-closed, not sess-open
    expect((await app.request("/sdk/sessions/open-tok/intro?reviewer=closed-rev")).status).toBe(
      404,
    );
  });

  it("rejects intro on a closed session with session_unavailable (423)", async () => {
    const { app } = makeApp();
    const res = await app.request("/sdk/sessions/closed-tok/intro?reviewer=closed-rev");
    expect(res.status).toBe(423);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe("session_unavailable");
  });

  it("returns intro copy and flips reviewer pending → active", async () => {
    const pendingRev = reviewer("rev-pending", poSession.id, "pending-rev");
    pendingRev.status = "pending";
    pendingRev.acceptedAt = null;
    const { app, repo } = makeApp({ reviewers: [pendingRev] });
    const res = await app.request("/sdk/sessions/po-tok/intro?reviewer=pending-rev");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projectName: string; sessionName: string };
    expect(body.projectName).toBe("PO Project");
    const after = await repo.getReviewer("rev-pending");
    expect(after?.status).toBe("active");
    expect(after?.acceptedAt).toBeTruthy();
  });
});

describe("annotation ingest (SDK)", () => {
  it("is idempotent on clientAnnotationId per (session, reviewer)", async () => {
    const { app } = makeApp();
    const first = await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify(annotationBody()),
    });
    expect(first.status).toBe(201);
    expect((await first.json()) as { created: boolean }).toMatchObject({ created: true });

    const second = await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify(annotationBody()),
    });
    expect(second.status).toBe(200);
    expect((await second.json()) as { created: boolean }).toMatchObject({ created: false });
  });

  it("400s an invalid body", async () => {
    const { app } = makeApp();
    const res = await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify(annotationBody({ pageUrl: "not-a-url" })),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("bad_request");
  });

  it("blocks ingest against a closed session (session_unavailable)", async () => {
    const { app } = makeApp();
    const res = await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("closed-tok", "closed-rev"),
      body: JSON.stringify(annotationBody()),
    });
    expect(res.status).toBe(423);
  });

  it("rejects a body whose submissionId does not match the URL path", async () => {
    const { app } = makeApp();
    const res = await app.request("/sdk/submissions/sub-9/annotations", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify(annotationBody({ submissionId: "sub-1" })),
    });
    expect(res.status).toBe(400);
  });
});

describe("submit", () => {
  it("404s an unknown submission and completes a known one", async () => {
    const { app } = makeApp();
    const missing = await app.request("/sdk/submissions/ghost/complete", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify({ submissionId: "ghost", clientId: "browser-1" }),
    });
    expect(missing.status).toBe(404);

    await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify(annotationBody()),
    });
    const ok = await app.request("/sdk/submissions/sub-1/complete", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify({ submissionId: "sub-1", clientId: "browser-1" }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ complete: true });
  });
});

describe("superadmin (Phase 2) + sessions (RS-7)", () => {
  it("requires a superadmin session for /admin/*", async () => {
    const { app } = makeApp();
    expect((await app.request("/admin/projects")).status).toBe(401);
    const poToken = await login(app, "po@speqify.app", "po-pass");
    const asPo = await app.request("/admin/projects", {
      headers: { authorization: `Bearer ${poToken}` },
    });
    expect(asPo.status).toBe(401);
  });

  it("creates a PO + project end-to-end; PO scopes session CRUD to own project", async () => {
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
    const project = (await projRes.json()) as { id: string; templates: Record<string, unknown> };
    // Without a `templates` field on create, the API seeds the default 4-type bundle.
    expect(project.templates).toHaveProperty("bug");
    expect(project.templates).toHaveProperty("change");
    expect(project.templates).toHaveProperty("feature");
    expect(project.templates).toHaveProperty("polish");

    // PO session CRUD: PO is scoped to their own project (prj_po here).
    const po = await login(app, "po@speqify.app", "po-pass");
    const poAuth = { authorization: `Bearer ${po}`, "content-type": "application/json" };

    const list = await app.request("/po/sessions", { headers: { authorization: `Bearer ${po}` } });
    expect(list.status).toBe(200);
    const initialSessions = ((await list.json()) as { sessions: ReviewSession[] }).sessions;
    expect(initialSessions.some((s) => s.token === "po-tok")).toBe(true);

    const createSess = await app.request("/po/sessions", {
      method: "POST",
      headers: poAuth,
      body: JSON.stringify({
        name: "Q1 smoke",
        envUrl: "https://staging.test",
        description: "",
        instructions: "",
      }),
    });
    expect(createSess.status).toBe(201);
    const newSess = (await createSess.json()) as { id: string; status: string; token: string };
    expect(newSess.status).toBe("draft");
    expect(newSess.token).toBeTruthy();

    // Publish via status transition draft -> live.
    const publish = await app.request(`/po/sessions/${newSess.id}/status`, {
      method: "POST",
      headers: poAuth,
      body: JSON.stringify({ status: "live" }),
    });
    expect(publish.status).toBe(200);
    expect((await publish.json()) as { status: string }).toMatchObject({ status: "live" });

    // Illegal transition closed -> live is rejected by canTransitionReviewSession.
    await app.request(`/po/sessions/${newSess.id}/status`, {
      method: "POST",
      headers: poAuth,
      body: JSON.stringify({ status: "closed" }),
    });
    const bad = await app.request(`/po/sessions/${newSess.id}/status`, {
      method: "POST",
      headers: poAuth,
      body: JSON.stringify({ status: "live" }),
    });
    expect(bad.status).toBe(400);
  });

  it("invites + revokes a reviewer; magic-link contains both tokens", async () => {
    const { app, repo } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    const poAuth = { authorization: `Bearer ${po}`, "content-type": "application/json" };
    const inv = await app.request(`/po/sessions/${poSession.id}/reviewers`, {
      method: "POST",
      headers: poAuth,
      body: JSON.stringify({ name: "Test Reviewer", email: "test@example.com" }),
    });
    expect(inv.status).toBe(201);
    const body = (await inv.json()) as {
      reviewer: { id: string; tokenHint: string };
      inviteUrl: string;
      emailSent: boolean;
    };
    expect(body.inviteUrl).toContain("speqify_session=po-tok");
    expect(body.inviteUrl).toContain("speqify_reviewer=");
    // NoopEmailSender never actually sends, so the PO is told to copy the link.
    expect(body.emailSent).toBe(false);

    const rev = await app.request(`/po/sessions/${poSession.id}/reviewers/${body.reviewer.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${po}` },
    });
    expect(rev.status).toBe(200);
    expect(((await rev.json()) as { status: string }).status).toBe("declined");

    // Revoked reviewers are forbidden from the SDK ingest path.
    const stored = (await repo.getReviewer(body.reviewer.id)) as Reviewer;
    const ingest = await app.request("/sdk/submissions/sub-x/annotations", {
      method: "POST",
      headers: sdkHeaders(poSession.token, stored.token),
      body: JSON.stringify(annotationBody({ submissionId: "sub-x" })),
    });
    expect(ingest.status).toBe(403);
  });
});

describe("product owner config (Phase 3)", () => {
  it("requires auth and scopes to the PO's own project", async () => {
    const { app } = makeApp();
    expect((await app.request("/po/project")).status).toBe(401);

    const po = await login(app, "po@speqify.app", "po-pass");
    const res = await app.request("/po/project", {
      headers: { authorization: `Bearer ${po}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      project: { id: string; templates: Record<string, unknown> };
      export: unknown;
    };
    expect(data.project.id).toBe("prj_po");
    expect(data.project.templates).toHaveProperty("bug");
    expect(data.export).toBeNull();
  });

  it("updates a single template tab and configures an encrypted export target", async () => {
    const { app } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    const h = { authorization: `Bearer ${po}`, "content-type": "application/json" };

    const tpl = await app.request("/po/project/templates", {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        taskType: "bug",
        template: {
          language: "pl",
          userStory: true,
          acceptanceCriteria: true,
          labels: ["frontend", "backend"],
          components: ["Cart"],
          versions: ["1.0"],
          customFields: {},
        },
      }),
    });
    expect(tpl.status).toBe(200);

    const exp = await app.request("/po/project/export", {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        target: "jira",
        credentials: { email: "bot@acme.test", apiToken: "super-secret-token" },
        defaults: { projectKey: "ACME", issueType: "Task" },
      }),
    });
    expect(exp.status).toBe(200);
    expect((await exp.json()) as { configured: boolean }).toMatchObject({ configured: true });

    const get = await app.request("/po/project", { headers: { authorization: `Bearer ${po}` } });
    const body = (await get.json()) as {
      project: { templates: { bug: { language: string } } };
      export: { target: string };
    };
    expect(body.project.templates.bug.language).toBe("pl");
    expect(body.export.target).toBe("jira");
    expect(JSON.stringify(body)).not.toContain("super-secret-token");

    const test = await app.request("/po/project/export/test", {
      method: "POST",
      headers: { authorization: `Bearer ${po}` },
    });
    expect(test.status).toBe(200);
    expect((await test.json()) as { ok: boolean }).toMatchObject({ ok: true });
  });

  it("replaces the full per-type templates bundle in one call", async () => {
    const { app, repo } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    const h = { authorization: `Bearer ${po}`, "content-type": "application/json" };
    const tpl = {
      ...baseTemplate,
      labels: ["whole"],
    };
    const res = await app.request("/po/project/templates", {
      method: "PUT",
      headers: h,
      body: JSON.stringify({ bug: tpl, change: tpl, feature: tpl, polish: tpl }),
    });
    expect(res.status).toBe(200);
    const project = await repo.getProject("prj_po");
    expect(project?.templates.bug.labels).toEqual(["whole"]);
    expect(project?.templates.polish.labels).toEqual(["whole"]);
  });
});

describe("media upload (Phase 5c, via SDK)", () => {
  it("uploads voice, serves it back, and the MediaRef ingests", async () => {
    const { app } = makeApp();
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    const up = await app.request("/sdk/uploads?kind=voice", {
      method: "POST",
      headers: {
        "content-type": "audio/webm",
        "x-speqify-session": "open-tok",
        "x-speqify-reviewer": "open-rev",
      },
      body: bytes,
    });
    expect(up.status).toBe(201);
    const ref = (await up.json()) as {
      bucketKey: string;
      contentType: string;
      bytes: number;
      publicUrl: string;
    };
    expect(ref.bytes).toBe(8);
    expect(ref.publicUrl).toContain(`/media/${ref.bucketKey}`);

    const got = await app.request(`/media/${ref.bucketKey}`);
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("audio/webm");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes);

    const ann = await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("open-tok", "open-rev"),
      body: JSON.stringify(annotationBody({ type: "voice", voice: ref })),
    });
    expect(ann.status).toBe(201);
  });

  it("rejects unknown kind, empty and closed-session uploads", async () => {
    const { app } = makeApp();
    const hdr = { "x-speqify-session": "open-tok", "x-speqify-reviewer": "open-rev" };
    expect(
      (
        await app.request("/sdk/uploads?kind=bogus", {
          method: "POST",
          headers: hdr,
          body: new Uint8Array([1]),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request("/sdk/uploads?kind=voice", {
          method: "POST",
          headers: hdr,
          body: new Uint8Array(0),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request("/sdk/uploads?kind=voice", {
          method: "POST",
          headers: {
            "content-type": "audio/webm",
            "x-speqify-session": "closed-tok",
            "x-speqify-reviewer": "closed-rev",
          },
          body: new Uint8Array([1, 2, 3]),
        })
      ).status,
    ).toBe(423);

    const missing = await app.request("/media/sessions/nope/x");
    expect(missing.status).toBe(404);
  });

  it("accepts screen-recording media kinds", async () => {
    const { app } = makeApp();
    for (const kind of ["recording-video", "recording-audio"]) {
      const up = await app.request(`/sdk/uploads?kind=${kind}`, {
        method: "POST",
        headers: {
          "content-type": "video/webm",
          "x-speqify-session": "open-tok",
          "x-speqify-reviewer": "open-rev",
        },
        body: new Uint8Array([9, 9, 9]),
      });
      expect(up.status).toBe(201);
    }
  });
});

async function ingestVoiceAndSubmit(
  app: ReturnType<typeof createApp>,
  sess = "open-tok",
  rev = "open-rev",
): Promise<string> {
  const up = await app.request("/sdk/uploads?kind=voice", {
    method: "POST",
    headers: { "content-type": "audio/webm", "x-speqify-session": sess, "x-speqify-reviewer": rev },
    body: new Uint8Array([1, 2, 3, 4]),
  });
  const ref = await up.json();
  const ann = await app.request("/sdk/submissions/sub-1/annotations", {
    method: "POST",
    headers: sdkHeaders(sess, rev),
    body: JSON.stringify(annotationBody({ type: "voice", voice: ref })),
  });
  const id = ((await ann.json()) as { id: string }).id;
  await app.request("/sdk/submissions/sub-1/complete", {
    method: "POST",
    headers: sdkHeaders(sess, rev),
    body: JSON.stringify({ submissionId: "sub-1", clientId: "browser-1" }),
  });
  return id;
}

describe("transcription (Phase 6)", () => {
  it("transcribes submitted voice annotations on the SA run", async () => {
    const { app, repo } = makeApp();
    const sa = await login(app, "admin@speqify.app", "s3cret-pass");
    const id = await ingestVoiceAndSubmit(app);

    const run = await app.request("/admin/transcribe/run", {
      method: "POST",
      headers: { authorization: `Bearer ${sa}` },
    });
    expect(run.status).toBe(200);
    expect((await run.json()) as { done: number }).toMatchObject({ done: 1 });

    const a = await repo.getAnnotationById(id);
    expect(a?.transcript).toBe("the transcribed text");
    expect(a?.transcriptionStatus).toBe("done");
  });

  it("marks failed then succeeds on the next run (retry)", async () => {
    let calls = 0;
    const flaky: Transcriber = {
      transcribe: async () => {
        calls++;
        if (calls < 2) throw new Error("provider down");
        return { text: "recovered" };
      },
    };
    const { app, repo } = makeApp(undefined, flaky);
    const sa = await login(app, "admin@speqify.app", "s3cret-pass");
    const id = await ingestVoiceAndSubmit(app);

    await app.request("/admin/transcribe/run", {
      method: "POST",
      headers: { authorization: `Bearer ${sa}` },
    });
    expect((await repo.getAnnotationById(id))?.transcriptionStatus).toBe("failed");

    await app.request("/admin/transcribe/run", {
      method: "POST",
      headers: { authorization: `Bearer ${sa}` },
    });
    const a = await repo.getAnnotationById(id);
    expect(a?.transcript).toBe("recovered");
    expect(a?.transcriptionStatus).toBe("done");
  });

  it("PO transcript edit: 404 unknown, 403 for a foreign annotation", async () => {
    const { app } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    const h = { authorization: `Bearer ${po}`, "content-type": "application/json" };

    const unknown = await app.request("/po/annotations/nope/transcript", {
      method: "PUT",
      headers: h,
      body: JSON.stringify({ transcript: "x" }),
    });
    expect(unknown.status).toBe(404);

    // ingestVoiceAndSubmit (default tokens) ingests into proj-1, not prj_po.
    const id = await ingestVoiceAndSubmit(app);
    const foreign = await app.request(`/po/annotations/${id}/transcript`, {
      method: "PUT",
      headers: h,
      body: JSON.stringify({ transcript: "x" }),
    });
    expect(foreign.status).toBe(403);
  });
});

async function seedPoAnnotations(app: ReturnType<typeof createApp>, ids: string[]): Promise<void> {
  for (const cid of ids) {
    await app.request("/sdk/submissions/sub-po/annotations", {
      method: "POST",
      headers: sdkHeaders("po-tok", "po-rev"),
      body: JSON.stringify(
        annotationBody({ clientAnnotationId: cid, submissionId: "sub-po", clientId: "b1" }),
      ),
    });
  }
  await app.request("/sdk/submissions/sub-po/complete", {
    method: "POST",
    headers: sdkHeaders("po-tok", "po-rev"),
    body: JSON.stringify({ submissionId: "sub-po", clientId: "b1" }),
  });
}

describe("AI analysis (Phase 7)", () => {
  it("no-op success when there are no submitted annotations", async () => {
    const { app } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    const res = await app.request("/po/analyze", {
      method: "POST",
      headers: { authorization: `Bearer ${po}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { status: string; tasksCreated: number }).toMatchObject({
      status: "succeeded",
      annotations: 0,
      tasksCreated: 0,
    });
  });

  it("turns submitted annotations into tasks, then marks them processed", async () => {
    const { app, repo } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    await seedPoAnnotations(app, ["a1", "a2"]);

    const res = await app.request("/po/analyze", {
      method: "POST",
      headers: { authorization: `Bearer ${po}` },
    });
    expect((await res.json()) as { annotations: number }).toMatchObject({
      status: "succeeded",
      annotations: 2,
      tasksCreated: 1,
    });
    expect(await repo.listTasks("prj_po")).toHaveLength(1);

    const again = await app.request("/po/analyze", {
      method: "POST",
      headers: { authorization: `Bearer ${po}` },
    });
    expect((await again.json()) as { annotations: number }).toMatchObject({
      annotations: 0,
      tasksCreated: 0,
    });
  });

  it("invalid LLM output fails the run and never persists tasks or processes annotations", async () => {
    const bad: LlmProvider = { complete: async () => "totally not json" };
    const { app, repo } = makeApp(undefined, undefined, bad);
    const po = await login(app, "po@speqify.app", "po-pass");
    await seedPoAnnotations(app, ["b1", "b2"]);

    const res = await app.request("/po/analyze", {
      method: "POST",
      headers: { authorization: `Bearer ${po}` },
    });
    expect((await res.json()) as { status: string }).toMatchObject({ status: "failed" });
    expect(await repo.listTasks("prj_po")).toHaveLength(0);
    expect(await repo.listSubmittedForProject("prj_po")).toHaveLength(2);
  });

  it("rejects a concurrent run (single in-flight per project)", async () => {
    const { app, repo } = makeApp();
    const po = await login(app, "po@speqify.app", "po-pass");
    await repo.startAnalysisRun("prj_po");
    const res = await app.request("/po/analyze", {
      method: "POST",
      headers: { authorization: `Bearer ${po}` },
    });
    expect(res.status).toBe(409);
  });
});

describe("PO review (Phase 8)", () => {
  const stamp = ts();
  const ann = (id: string, over: Partial<Annotation> = {}): Annotation => ({
    id,
    sessionId: poSession.id,
    reviewerId: poReviewer.id,
    submissionId: "sub-rev",
    type: "element",
    status: "processed",
    pageUrl: `${ENV_URL}/orders`,
    breadcrumb: [],
    element: { selector: "button.export", xpath: "/html/body/button", html: "<button/>" },
    screenshot: null,
    voice: null,
    recordingVideo: null,
    recordingAudio: null,
    transcript: "should also email the report",
    transcriptionStatus: "done",
    textNote: null,
    tags: ["export"],
    structured: { kind: "change", severity: "medium" },
    technical: null,
    hostApp: null,
    clientCreatedAt: stamp,
    serverCreatedAt: stamp,
    correlationId: `cor-${id}`,
    ...over,
  });
  const task = (id: string, over: Partial<Task> = {}): Task => ({
    id,
    projectId: "prj_po",
    status: "generated",
    parentTaskId: null,
    title: `Task ${id}`,
    description: "desc",
    acceptanceCriteria: ["Given x", "When y", "Then z"],
    labels: ["export"],
    component: null,
    version: null,
    priority: "medium",
    confidence: 0.9,
    subtaskType: null,
    annotationIds: ["ann-1", "ann-2"],
    screenshotKeys: [],
    externalId: null,
    exportError: null,
    reviewedAt: null,
    rev: 1,
    createdAt: stamp,
    ...over,
  });

  function reviewApp() {
    const repo = new InMemoryRepository({
      reviewSessions: [poSession],
      reviewers: [poReviewer],
      users: [
        {
          id: "usr_po",
          role: "product_owner",
          email: "po@speqify.app",
          displayName: "Demo PO",
          passwordHash: poHash,
          createdAt: stamp,
        },
      ],
      projects: [poProject],
      annotations: [ann("ann-1"), ann("ann-2", { type: "global", element: null })],
      tasks: [task("tsk-1"), task("tsk-2"), task("tsk-empty", { annotationIds: [] })],
    });
    return {
      app: createApp({
        repo,
        config,
        mediaStore: new InMemoryMediaStore(),
        transcriber: okTranscriber(),
        llm: okLlm('{"tasks":[{"title":"Regenerated title","confidence":0.7}]}'),
        emailSender: new NoopEmailSender(),
      }),
      repo,
    };
  }
  const auth = (tok: string) => ({ authorization: `Bearer ${tok}` });
  const post = (
    app: ReturnType<typeof createApp>,
    path: string,
    tok: string,
    bodyObj: unknown,
    method = "POST",
  ) =>
    app.request(path, {
      method,
      headers: { ...auth(tok), "content-type": "application/json" },
      body: JSON.stringify(bodyObj),
    });

  it("fetches a task and its resolved source annotations", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const t = await app.request("/po/tasks/tsk-1", { headers: auth(tok) });
    expect(t.status).toBe(200);
    expect(((await t.json()) as { task: Task }).task.title).toBe("Task tsk-1");

    const a = await app.request("/po/tasks/tsk-1/annotations", { headers: auth(tok) });
    expect(a.status).toBe(200);
    const { annotations } = (await a.json()) as { annotations: { selector: string | null }[] };
    expect(annotations).toHaveLength(2);
    expect(annotations[0]?.selector).toBe("button.export");
  });

  it("404s an unknown / non-owned task", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    expect((await app.request("/po/tasks/nope", { headers: auth(tok) })).status).toBe(404);
  });

  it("accept transitions generated -> accepted, stamps review, bumps rev", async () => {
    const { app, repo } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const res = await post(app, "/po/tasks/tsk-1/accept", tok, { expectedRev: 1 });
    expect(res.status).toBe(200);
    const t = await repo.getTask("tsk-1");
    expect(t?.status).toBe("accepted");
    expect(t?.reviewedAt).toBeTruthy();
    expect(t?.rev).toBe(2);
  });

  it("rejects a stale expectedRev with 409 conflict", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const res = await post(app, "/po/tasks/tsk-1/accept", tok, { expectedRev: 99 });
    expect(res.status).toBe(409);
  });

  it("cannot accept a task that is not generated", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    await post(app, "/po/tasks/tsk-1/accept", tok, { expectedRev: 1 });
    const again = await post(app, "/po/tasks/tsk-1/accept", tok, { expectedRev: 2 });
    expect(again.status).toBe(400);
  });

  it("reject transitions generated -> rejected", async () => {
    const { app, repo } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const res = await post(app, "/po/tasks/tsk-2/reject", tok, { expectedRev: 1 });
    expect(res.status).toBe(200);
    expect((await repo.getTask("tsk-2"))?.status).toBe("rejected");
  });

  it("edits a generated task; refuses to edit an accepted one", async () => {
    const { app, repo } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const edit = {
      title: "Edited title",
      description: "new",
      acceptanceCriteria: ["Given a", "Then b"],
      labels: ["export", "notifications"],
      component: "orders",
      version: "1.1",
      priority: "high",
      subtaskType: null,
      expectedRev: 1,
    };
    const ok = await post(app, "/po/tasks/tsk-1", tok, edit, "PUT");
    expect(ok.status).toBe(200);
    expect((await repo.getTask("tsk-1"))?.title).toBe("Edited title");

    await post(app, "/po/tasks/tsk-2/accept", tok, { expectedRev: 1 });
    const blocked = await post(app, "/po/tasks/tsk-2", tok, { ...edit, expectedRev: 2 }, "PUT");
    expect(blocked.status).toBe(400);
  });

  it("regenerate replaces task content from its annotations", async () => {
    const { app, repo } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const res = await post(app, "/po/tasks/tsk-1/regenerate", tok, { expectedRev: 1 });
    expect(res.status).toBe(200);
    const t = await repo.getTask("tsk-1");
    expect(t?.title).toBe("Regenerated title");
    expect(t?.confidence).toBe(0.7);
    expect(t?.rev).toBe(2);
  });

  it("regenerate 400s a task with no source annotations", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const res = await post(app, "/po/tasks/tsk-empty/regenerate", tok, { expectedRev: 1 });
    expect(res.status).toBe(400);
  });

  it("exports accepted tasks (JSON) idempotently and marks them exported", async () => {
    const { app, repo } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    await post(app, "/po/tasks/tsk-1/accept", tok, { expectedRev: 1 });

    const r1 = await post(app, "/po/tasks/export?format=json", tok, {});
    expect(r1.status).toBe(200);
    const e1 = (await r1.json()) as { total: number; newlyExported: number; content: string };
    expect(e1.newlyExported).toBe(1);
    expect(e1.total).toBe(1);
    expect((await repo.getTask("tsk-1"))?.status).toBe("exported");
    expect((await repo.getTask("tsk-1"))?.externalId).toBe("speqify:tsk-1");
    expect(JSON.parse(e1.content).tasks[0].externalId).toBe("speqify:tsk-1");

    const r2 = await post(app, "/po/tasks/export?format=json", tok, {});
    const e2 = (await r2.json()) as { total: number; newlyExported: number };
    expect(e2.newlyExported).toBe(0);
    expect(e2.total).toBe(1);
  });

  it("exports CSV with a header row", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    await post(app, "/po/tasks/tsk-2/accept", tok, { expectedRev: 1 });
    const r = await post(app, "/po/tasks/export?format=csv", tok, {});
    expect(r.status).toBe(200);
    const e = (await r.json()) as { format: string; content: string };
    expect(e.format).toBe("csv");
    expect(e.content.split("\r\n")[0]).toContain("externalId");
  });

  it("export 400s when nothing is accepted", async () => {
    const { app } = reviewApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const r = await post(app, "/po/tasks/export?format=json", tok, {});
    expect(r.status).toBe(400);
  });
});

describe("SA dashboard data (Tranche B)", () => {
  const sa = (app: ReturnType<typeof createApp>) => login(app, "admin@speqify.app", "s3cret-pass");

  it("returns live admin stats", async () => {
    const { app } = makeApp();
    const tok = await sa(app);
    const res = await app.request("/admin/stats", { headers: { authorization: `Bearer ${tok}` } });
    expect(res.status).toBe(200);
    const s = (await res.json()) as { projects: number; productOwners: number };
    expect(s.projects).toBe(2);
    expect(s.productOwners).toBe(1);
  });

  it("records audit entries on user create and lists them newest-first", async () => {
    const { app } = makeApp();
    const tok = await sa(app);
    await app.request("/admin/users", {
      method: "POST",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
      body: JSON.stringify({ email: "po2@x.test", displayName: "PO Two" }),
    });
    const res = await app.request("/admin/audit", {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
    const { entries } = (await res.json()) as { entries: { kind: string }[] };
    expect(entries[0]?.kind).toBe("user.created");
  });

  it("sets project status (SA only) and audits it", async () => {
    const { app, repo } = makeApp();
    const tok = await sa(app);
    const res = await app.request("/admin/projects/prj_po/status", {
      method: "POST",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    expect(res.status).toBe(200);
    expect((await repo.getProject("prj_po"))?.status).toBe("archived");
    const audit = await repo.listAudit(5);
    expect(audit.some((a) => a.kind === "project.status")).toBe(true);
  });

  it("stores provider config and echoes only a masked key hint", async () => {
    const { app } = makeApp();
    const tok = await sa(app);
    const put = await app.request("/admin/providers", {
      method: "PUT",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
      body: JSON.stringify({
        aiProvider: "claude",
        aiModel: "claude-sonnet-4-6",
        aiKey: "sk-secret-abcd",
        transcriptionProvider: "workers-ai",
      }),
    });
    expect(put.status).toBe(200);
    const get = await app.request("/admin/providers", {
      headers: { authorization: `Bearer ${tok}` },
    });
    const { config } = (await get.json()) as {
      config: { aiKeyConfigured: boolean; aiKeyHint: string; aiModel: string } | null;
    };
    expect(config?.aiKeyConfigured).toBe(true);
    expect(config?.aiKeyHint).toBe("abcd");
    expect(JSON.stringify(config)).not.toContain("sk-secret-abcd");
  });

  it("blocks a PO from admin stats (role guard)", async () => {
    const { app } = makeApp();
    const tok = await login(app, "po@speqify.app", "po-pass");
    const res = await app.request("/admin/stats", {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(401);
  });
});

describe("ingest tags, intro project name, leads (Tranche D)", () => {
  it("persists annotation tags through ingest", async () => {
    const { app, repo } = makeApp();
    const res = await app.request("/sdk/submissions/sub-1/annotations", {
      method: "POST",
      headers: sdkHeaders("po-tok", "po-rev"),
      body: JSON.stringify(annotationBody({ tags: ["billing", "urgent"] })),
    });
    expect(res.status).toBe(201);
    const id = ((await res.json()) as { id: string }).id;
    expect((await repo.getAnnotationById(id))?.tags).toEqual(["billing", "urgent"]);
  });

  it("/sdk/sessions/:t/intro exposes the project display name", async () => {
    const { app } = makeApp();
    const res = await app.request("/sdk/sessions/po-tok/intro?reviewer=po-rev");
    expect(res.status).toBe(200);
    expect((await res.json()) as { projectName: string }).toMatchObject({
      projectName: "PO Project",
    });
  });

  it("accepts a closed-beta lead from any origin and audits it", async () => {
    const { app, repo } = makeApp();
    const res = await app.request("/leads", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://speqify.app" },
      body: JSON.stringify({ email: "team@acme.test", locale: "pl" }),
    });
    expect(res.status).toBe(201);
    const leads = await repo.listLeads(5);
    expect(leads[0]?.email).toBe("team@acme.test");
  });

  it("rejects a malformed lead email", async () => {
    const { app } = makeApp();
    const res = await app.request("/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });
});
