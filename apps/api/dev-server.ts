/**
 * Local dev server (no wrangler/workerd): serves the Hono app on Node via
 * @hono/node-server with an in-memory repo + seeded demo data, so the SA/PO
 * panels are usable end-to-end without Cloudflare. Run with tsx.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { NoopLlmProvider } from "./src/analysis/providers.js";
import { createApp } from "./src/app.js";
import { resolveConfig, type Env } from "./src/env.js";
import { InMemoryMediaStore } from "./src/media/memory.js";
import { InMemoryRepository } from "./src/repo/memory.js";
import { NoopTranscriber } from "./src/transcribe/providers.js";

const here = dirname(fileURLToPath(import.meta.url));

function parseDevVars(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(here, ".dev.vars"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {
    /* fall through to defaults below */
  }
  return out;
}

const env = parseDevVars() as unknown as Env;
const config = resolveConfig(env);

const now = new Date().toISOString();
const repo = new InMemoryRepository({
  users: [
    {
      id: "usr_po_dev",
      role: "product_owner",
      email: "po@speqify.app",
      displayName: "Demo PO",
      // password: Speqify-PO-dev-2026!  (dev only)
      passwordHash:
        "pbkdf2$100000$apXfTrvVfuxSxAjjNZC6-g$cha1mfP_EnhXCxPKPyTvBEiAscNt1LnrQmwd9ivgpa8",
      createdAt: now,
    },
  ],
  projects: [
    {
      id: "prj_demo",
      name: "Demo Project",
      productOwnerId: "usr_po_dev",
      environmentUrls: ["http://localhost:5173"],
      status: "live",
      template: {
        language: "en",
        userStory: true,
        acceptanceCriteria: true,
        labels: ["frontend", "backend"],
        components: ["Cart", "Checkout"],
        versions: ["1.0"],
        customFields: {},
      },
      exportConfigId: null,
      createdAt: now,
    },
  ],
  panels: [
    {
      id: "pnl_demo",
      projectId: "prj_demo",
      audience: "client",
      secretToken: "demo-panel-token",
      environmentUrl: "http://localhost:5173",
      status: "open",
      createdAt: now,
    },
  ],
  // Demo review queue so the PO panel is usable offline (Phase 8).
  annotations: [
    {
      id: "ann_demo_1",
      panelId: "pnl_demo",
      submissionId: "sub_demo",
      type: "element",
      status: "processed",
      audience: "client",
      pageUrl: "http://localhost:5173/dashboard/orders",
      breadcrumb: [],
      element: {
        selector: 'button.btn-export[data-action="export"]',
        xpath: "/html/body/main/section[3]/div[6]/button",
        html: '<button class="btn-export" data-action="export">Export report</button>',
      },
      screenshot: null,
      voice: null,
      recordingVideo: null,
      recordingAudio: null,
      transcript:
        "After export the report should also land in the PO's email and as a Slack attachment — right now it only downloads a CSV.",
      transcriptionStatus: "done",
      textNote: null,
      tags: ["export", "notifications"],
      structured: { kind: "change", severity: "medium" },
      technical: null,
      hostApp: null,
      clientCreatedAt: now,
      serverCreatedAt: now,
      correlationId: "cor_demo_1",
    },
    {
      id: "ann_demo_2",
      panelId: "pnl_demo",
      submissionId: "sub_demo",
      type: "global",
      status: "processed",
      audience: "client",
      pageUrl: "http://localhost:5173/dashboard/orders",
      breadcrumb: [],
      element: null,
      screenshot: null,
      voice: null,
      recordingVideo: null,
      recordingAudio: null,
      transcript: null,
      transcriptionStatus: null,
      textNote:
        "Export — please add distribution by email to the PO and to the Slack #orders channel.",
      tags: ["export"],
      structured: { kind: "change", severity: "low" },
      technical: null,
      hostApp: null,
      clientCreatedAt: now,
      serverCreatedAt: now,
      correlationId: "cor_demo_2",
    },
    {
      id: "ann_demo_3",
      panelId: "pnl_demo",
      submissionId: "sub_demo",
      type: "element",
      status: "processed",
      audience: "tester",
      pageUrl: "http://localhost:5173/dashboard/orders",
      breadcrumb: [],
      element: {
        selector: ".host-table",
        xpath: "/html/body/main/section[3]/div[2]",
        html: '<div class="host-table">…</div>',
      },
      screenshot: null,
      voice: null,
      recordingVideo: null,
      recordingAudio: null,
      transcript: "There is no pagination below 50 orders — the page freezes around 200+ rows.",
      transcriptionStatus: "done",
      textNote: null,
      tags: ["pagination", "performance"],
      structured: { kind: "bug", severity: "high" },
      technical: null,
      hostApp: null,
      clientCreatedAt: now,
      serverCreatedAt: now,
      correlationId: "cor_demo_3",
    },
  ],
  tasks: [
    {
      id: "tsk_demo_1",
      projectId: "prj_demo",
      status: "generated",
      parentTaskId: null,
      title: "Order report export should also email a copy and notify Slack",
      description:
        "A reviewer reported during the Q1 review that the Export report button only downloads a CSV. The PO expects the report to also be emailed to the person running the action and posted as an attachment to the Slack #orders channel.",
      acceptanceCriteria: [
        "Given a PO is on Orders and clicked Export report,",
        "When the backend generates the CSV successfully,",
        "Then the system emails a copy with the CSV attached to the PO and posts it to Slack #orders with a link to the in-app report.",
      ],
      labels: ["export", "notifications"],
      component: "orders/export",
      version: "1.0",
      priority: "medium",
      confidence: 0.92,
      subtaskType: null,
      annotationIds: ["ann_demo_1", "ann_demo_2"],
      screenshotKeys: [],
      externalId: null,
      exportError: null,
      reviewedAt: null,
      rev: 1,
      createdAt: now,
    },
    {
      id: "tsk_demo_1a",
      projectId: "prj_demo",
      status: "generated",
      parentTaskId: "tsk_demo_1",
      title: "BE: new endpoint POST /reports/orders/notify (email + slack-channel)",
      description: "Backend endpoint that emails the CSV and posts to Slack.",
      acceptanceCriteria: [],
      labels: ["backend"],
      component: "orders/export",
      version: "1.0",
      priority: "medium",
      confidence: null,
      subtaskType: "backend",
      annotationIds: ["ann_demo_1"],
      screenshotKeys: [],
      externalId: null,
      exportError: null,
      reviewedAt: null,
      rev: 1,
      createdAt: now,
    },
    {
      id: "tsk_demo_2",
      projectId: "prj_demo",
      status: "generated",
      parentTaskId: null,
      title: "Orders table has no pagination above 50 rows — page freezes at 200+",
      description:
        "The orders table renders every row; beyond ~200 rows the page becomes unresponsive. Add server-side pagination.",
      acceptanceCriteria: [
        "Given more than 50 orders exist,",
        "When the orders table is opened,",
        "Then rows are paginated (50/page) and the page stays responsive at 1000+ orders.",
      ],
      labels: ["frontend", "performance"],
      component: "Orders",
      version: "1.0",
      priority: "high",
      confidence: 0.86,
      subtaskType: null,
      annotationIds: ["ann_demo_3"],
      screenshotKeys: [],
      externalId: null,
      exportError: null,
      reviewedAt: null,
      rev: 1,
      createdAt: now,
    },
    {
      id: "tsk_demo_3",
      projectId: "prj_demo",
      status: "generated",
      parentTaskId: null,
      title: "Dashboard NPS chart shows an empty state instead of “no data”",
      description:
        "When there is no NPS data the chart area is blank; show an explicit empty state.",
      acceptanceCriteria: [],
      labels: ["frontend"],
      component: "Dashboard",
      version: "1.0",
      priority: "low",
      confidence: 0.48,
      subtaskType: null,
      annotationIds: [],
      screenshotKeys: [],
      externalId: null,
      exportError: null,
      reviewedAt: null,
      rev: 1,
      createdAt: now,
    },
  ],
});

// Demo platform provider config so the SA dashboard "Dostawcy AI" is populated.
await repo.setPlatformConfig({
  config: {
    aiProvider: "claude",
    aiModel: "claude-sonnet-4-6",
    transcriptionProvider: "workers-ai",
  },
  aiKeyRef: "dev-ref",
  aiKeyHint: "a7c2",
});

const app = createApp({
  repo,
  config,
  mediaStore: new InMemoryMediaStore(),
  transcriber: new NoopTranscriber(),
  llm: new NoopLlmProvider(),
});

const port = 8787;
serve({ fetch: app.fetch, port });
console.log(`speqify-api (dev, in-memory) listening on http://127.0.0.1:${port}`);
