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
