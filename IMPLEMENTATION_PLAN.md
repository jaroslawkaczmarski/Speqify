# Speqify — Implementation Plan

> **Living document.** Update checkboxes as work progresses. Add new tasks under the
> relevant phase. Record every meaningful change in the **Revision Log** at the bottom.
> Keep this file in sync with reality — it is the single source of truth for scope and status.

- **Status:** In progress — Phases 0–7 shipped (logic) + full SA/PO panel UI; Phase 8 (Review) next. Plan kept in sync per phase. **Correction (2026-05-19):** Cloudflare Queues are on the **Free** plan since 2026-02-04 and Workflows are on **both Free and Paid** — they were never a Workers-Paid gate. Workers Paid is now purchased anyway (rationale: 30s CPU/invocation vs Free's 10ms — PBKDF2 auth + analysis JSON parsing — plus headroom), and the transcription Queue runtime is now wired.
- **Last updated:** 2026-05-19
- **Owner:** TBD
- **Related docs:** [`DESIGN.md`](./DESIGN.md) (Convergence design system — landing page authority)

### Status legend

- `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped / out of scope

---

## 1. Product summary

Speqify lets PMs / business analysts collect requirements **directly on a running web
application**. A reviewer (client, tester, PO) marks UI elements, records voice notes,
and writes text notes on the live app. After a session, AI transcribes the audio,
analyses everything collectively, and drafts structured tasks following the project's
template. The PO reviews/edits/accepts each task and exports to Jira / GitHub / JSON / CSV.

**Key constraints (locked):**

- The evaluated apps are **our own apps** (built for clients). We have the source, so the
  overlay ships as an **embedded SDK** (no iframe, no reverse proxy).
- Sessions are **asynchronous** (PO and reviewers act independently).
- Voice notes are a first-class feature; transcription + AI analysis run **after** the
  session, not in real time.
- AI / transcription providers are configurable (own API keys).
- Hosted entirely on **Cloudflare**.

**Explicitly dropped for V1:** source-code indexing / RAG context (additive later, no
re-architecture needed).

---

## 2. Architecture overview

```
                          ┌─────────────────────────────────────────┐
   Our client app  ──────▶│  Speqify Overlay SDK (loader + UI)       │
   (test env, gated)      │  element pick · screenshot · voice · text│
                          └───────────────┬─────────────────────────┘
                                           │ HTTPS (CORS allowlist)
                                           ▼
   ┌──────────────┐   ┌────────────────────────────────────────────────────┐
   │  Landing      │   │  Speqify API  (Hono on Cloudflare Workers)         │
   │  (Convergence)│   │  auth · panels · ingest · submit · analyze · export│
   └──────────────┘   └───┬───────┬───────────┬───────────┬───────────┬────┘
                          │       │           │           │           │
                          ▼       ▼           ▼           ▼           ▼
                        D1 +    R2          Queues      Workflows   AI Gateway
                        Drizzle (audio +    (transcr.)  (analysis,  → LLM (vision)
                                screenshots)            export)     + Workers AI Whisper
                          ▲
              ┌───────────┴───────────┐
              │ Panel app (SA + PO)   │  React + Vite (Workers Static Assets)
              │ admin · config · review│
              └───────────────────────┘

   Secrets Store: platform AI/transcription keys + master key (envelope encryption)
```

### Repo structure (monorepo, pnpm workspaces + Turborepo)

```
speqify/
  apps/
    panel/      # SuperAdmin + Product Owner web app (React + Vite SPA)
    api/        # Hono Worker: REST API, panel validation, ingest, export, workflows entry
    landing/    # Marketing site — Convergence design system (static, Workers Assets)
  packages/
    sdk/        # Overlay SDK: loader + overlay UI -> static bundle + npm package
    db/         # Drizzle schema + D1 migrations
    shared/     # Shared TS types, zod schemas, constants, state-machine defs
  workflows/    # Cloudflare Workflows definitions (analysis, export)  [may live in apps/api]
  infra/        # wrangler configs, bindings, CI scripts
  IMPLEMENTATION_PLAN.md
  DESIGN.md
```

---

## 3. Tech stack (Cloudflare mapping)

| Layer | Choice | Notes |
|---|---|---|
| Panel (SA/PO) web | React + Vite SPA on Workers Static Assets | Hono can SSR if needed; SPA is enough for an internal tool |
| API | Hono Worker | REST; serves SDK bundle as static asset |
| Overlay SDK | TS bundle → Workers Static Assets + `@speqify/sdk` npm pkg | Versioned, immutable, env-gated |
| Relational DB | D1 + Drizzle ORM | Drizzle over Prisma (first-class on D1, lighter) |
| Object storage | R2 | Audio + screenshots; screenshots get URL for Jira/GitHub linking |
| Transcription queue | Cloudflare Queues | Producer on voice upload → consumer transcribes |
| Default transcription | Workers AI Whisper (`@cf/openai/whisper`) | Pluggable: Groq / OpenAI per platform config |
| Long jobs | Cloudflare Workflows | Analysis + export: durable, per-step retry |
| Task generation | AI Gateway → LLM with **vision** | Claude / GPT-4o / Gemini; screenshots are model input |
| Auth | Better Auth (D1) | SA = single shared credential; PO = SA-created accounts; panels = capability tokens |
| Secrets | Secrets Store + envelope encryption in D1 | Platform AI/transcription keys (SA); Jira/GitHub creds per project (PO) |
| CI/CD | Wrangler + GitHub Actions | `staging` / `prod` environments |
| Observability | Workers Logs / Logpush + Sentry | Tail queue + workflow consumers |

---

## 4. Data model & state machines

### Entities (conceptual — finalise in `packages/db`)

- **User** — `superadmin` | `product_owner`. SA: single shared credential. PO: created by SA.
- **Project** — created by SA; assigned PO; target environment URL(s); task template; export config.
- **Panel** — belongs to Project; audience role (`client` | `tester` | `po`); secret token;
  bound environment URL; status (`open` | `closed`).
- **Annotation** — belongs to Panel + a **Submission** batch; `type` (`element` | `global`
  | `voice` | `recording`); page URL + navigation breadcrumb; element `{selector, xpath,
  html}` (nullable); screenshot (R2); voice (R2); **screen recording (video R2 + parallel
  audio R2 for transcript)**; transcript; textNote; structured fields (type/severity);
  auto technical context (console/errors/network/env); host-app context (build/env/user/
  flags); status; client + server timestamps; `correlationId`.
- **Submission** — a reviewer's "Send" batch within a Panel (id, time, completeness); the
  unit AI analysis snapshots and the unit of incremental processing.
- **Task** — generated from annotations; title, description, AC, labels, component,
  version; parent/subtask; linked annotations + screenshots; status; externalId.
- **PlatformProviderConfig** — AI + transcription provider/keys (SA, platform-wide).
- **ExportConfig** — per project (PO): target type, encrypted credentials, field mapping, defaults.

### State machines

```
Annotation:  draft ──Send──▶ submitted ──AI analysis──▶ processed
Task:        generated ──Review──▶ accepted ──export──▶ exported
                            └─────▶ rejected         └─▶ export_failed ──retry──▶ exported
```

- Annotations are consumed **incrementally**: an AI run only takes `submitted` +
  not-yet-`processed` annotations. Accepted tasks persist across re-runs.
- Export is **idempotent**: `externalId` mapping prevents duplicates; only failed tasks retry.

---

## 5. End-to-end workflow (recap)

0. **SA setup** — login (single password); set platform AI + transcription keys; create
   project + environment URLs; create PO account (generated password) + share panel link.
1. **PO project config** — task template (language, AC, labels, custom fields); export
   target (Jira / GitHub / JSON-CSV) + credentials + field mapping; **test task** validation.
2. **PO panels** — create/delete panels; audience role; env URL; secret token; open/close.
3. **Reviewer feedback (SDK)** — open app (env-gated SDK active), token binds session to
   panel; navigate (route tracked); mark elements / global notes / voice (re-recordable) /
   text (editable); autosave as `draft`; **Send** → `submitted`; voice → transcription queue.
4. **PO triggers AI analysis** — gather submitted+unprocessed + template + screenshots
   (vision) → LLM via AI Gateway → grouped tasks (+ subtasks); mark annotations `processed`.
5. **PO review** — list + keyboard shortcuts; per-task accept/reject/edit/split/merge.
6. **PO export** — push to Jira/GitHub (create-only) or JSON/CSV; screenshots hosted on R2
   and embedded as links; idempotent; per-task error surfacing + retry.

---

## 6. Implementation roadmap

### Phase 0 — Foundations & scaffolding  ✅ done
- [x] Init monorepo (pnpm workspaces + Turborepo), TS strict, ESLint, Prettier, Vitest
- [~] Cloudflare resources: D1 ✓ (EU/WEUR, migrated+seeded) · R2 ✓ (speqify-media) · Queue `speqify-transcription` ✓ (on Free since 2026-02-04; Workers Paid now active) · Secrets Store ✗ (local `.dev.vars`; prod TODO)
- [x] `wrangler` config per app + staging/production envs (D1/R2 bound; queues/AI commented for Phase 6)
- [x] GitHub Actions: lint, typecheck, test, build — [~] `wrangler deploy` step deferred to deploy phase
- [x] `packages/shared`: types, zod schemas, state machines (+ tests)
- [x] Panel app = React + Vite SPA

### Phase 1 — Data model & core API  ✅ done
- [x] `packages/db`: Drizzle schema (all entities) + relations + status enums + migration
- [x] D1 migration applied + dev seed (PO, project, panel) via MCP
- [x] `apps/api`: Hono — routing, error envelope, zod validation, request logging, correlationId
- [x] Auth middleware + capability-token (panel) middleware
- [~] Auth = lightweight HMAC session + PBKDF2 per locked §10/§11 minimal-auth decision (Better Auth not used — substituted, tested)

### Phase 2 — SuperAdmin  ✅ done (provider-config partial)
- [x] SA login (single shared credential)
- [x] CRUD projects + environment URL(s); list users
- [x] Create PO account → generated password surfaced once
- [~] Platform provider config: transcription via env wired; AI-provider config-as-entity lands with Phase 7; export creds envelope-encrypted (§9)
- [x] SA UI in `apps/panel` — app shell (sidebar + subpages, hash router), Convergence design system via shared `@speqify/tokens` (§8.3 single source), role-branched, accessible hover/focus

### Phase 3 — Product Owner: project config  ✅ done (backend + UI)
- [x] PO scoping (session → own project; SA via `?projectId`)
- [x] Task template editor — backend + **PO UI** (Overview, Task template form)
- [x] Export target config UI: Jira | GitHub | JSON/CSV, per-target credential/defaults inputs, envelope-encrypted, secrets never shown back
- [x] **Test task** UI: `POST /po/project/export/test` with per-check result; live Jira/GitHub probe in Phase 9
- [x] PO Tasks page: list + "Run AI analysis" trigger (accept/reject = Phase 8)

### Phase 4 — Panels management  ✅ done
- [x] CRUD panels: audience, bound env URL, generated secret token, `open`/`closed`
- [x] Panel deletion = revoke link; close/reopen
- [x] `GET /panels/:token` validate + Origin allowlist on ingest + Install-snippet UI

### Phase 5 — Overlay SDK  ✅ feature-complete (SDK 0.5.0)
**Capture**
- [x] Loader (env-gated, token from URL/launcher), validates panel, Shadow-DOM overlay
- [x] Element picker: selector + xpath + outer html + bbox
- [x] Screenshot (html2canvas lazy-CDN) + **redaction/blur tool**
- [x] Voice note (MediaRecorder), **re-record**
- [x] **Screen recording**: getDisplayMedia + **parallel mic-audio** (transcription reuses voice pipeline)
- [x] Text + **global note**; structured prompt (bug/change, severity)
- [x] Route tracking + **action breadcrumb**
- [x] **Auto technical context** (console/errors/fetch, browser/OS/screen) — safe patch, restored on stop
- [x] **Host-app context injection** via SDK init
**Resilience & privacy**
- [x] **Offline drafts (IndexedDB outbox)** + retry/backoff
- [x] **Idempotent Send** (client ids; server dedupes) + media upload
- [x] **Consent notice** on first use
- [x] **Data scrubbing** (strip auth/secrets, size caps, console ring-buffer)
- [x] Edit text / re-record before Send
- [x] CSP/permission graceful fallback
**Quality**
- [x] CORS allowlist (project env origins); overlay isolated (Shadow DOM)
- [~] Accessibility/browser-matrix — basic; full a11y + Safari QA deferred
- [~] **SDK distribution**: esbuild IIFE bundle produced; CDN serving + npm publish = deploy/ops (§7)

### Phase 6 — Async transcription  ✅ logic + queue runtime wired
- [x] Audio (voice + recording-audio) uploaded to R2
- [x] Provider abstraction + `runOnce` done & tested; Cloudflare **Queue runtime wired** — producer pokes `TRANSCRIPTION_QUEUE` on panel submit, `queue()` consumer runs the idempotent `runOnce` sweep. Manual `POST /admin/transcribe/run` kept as backstop. (Queues on Free since 2026-02-04 — no Workers-Paid gate.) Cron backstop still optional/deferred.
- [x] Language hint param + PO-editable transcript (`PUT /po/annotations/:id/transcript`) + manual re-run
- [~] `superseded` status modelled; retry-on-next-run; segmentation + dead-letter cap deferred
- [~] Empty/silent → flagged done; long-audio segment/stitch deferred
- [x] Transcript write-back; failed → retried next run; PO manual transcript

### Phase 7 — AI analysis  ✅ logic done (e2e needs an LLM provider key — NOT a plan gate)
- [x] PO trigger (`POST /po/analyze`); **single in-flight run per project** (repo lock → 409)
- [x] **Snapshot submitted+unprocessed annotations at run start** (re-run incremental)
- [x] Collect: annotations + template + transcript + technical + host-app into prompt
- [x] Prompt builder: language/AC/labels/component-version; **untrusted `<ANNOTATIONS>` block, prompt-injection-hardened**
- [~] Map-reduce for very large sets / vision keyframes — deferred (single-shot prompt for now)
- [x] LLM port (HTTP AI-Gateway/Noop) + grouping + parent/subtasks; **structured-output validation + 1 repair**; hallucinated annotationIds filtered
- [x] **Persist tasks THEN mark `processed`** (failure ⇒ re-analyzable, no tasks persisted) — true D1 atomic batch deferred
- [x] Zero annotations → no-op success; provider/invalid → run failed (actionable); idempotent
- [x] Re-run incremental; **only inserts new tasks — existing never mutated**
- [x] **`confidence` (0–1) per generated task** in the structured output + repair schema (surfaced in PO review list/detail per design); `subtaskType` added too; prompt instructs both
- [~] Runtime trigger = Cloudflare Workflow (available on **both Free and Paid** — no plan gate) + LLM provider key (SuperAdmin config) — manual `POST /po/analyze` provided

### Phase 8 — Review & accept  ✅ core shipped (accept/reject/edit/regenerate + source annotations; split/merge + media attach deferred)
> **Design-derived (handoff = requirements).** The PO Panel prototype is the
> review screen; these are the concrete endpoints/fields it needs.
- [x] **API: task review endpoints** — `GET /po/tasks/:id`,
      `POST /po/tasks/:id/accept`, `POST /po/tasks/:id/reject`,
      `PUT /po/tasks/:id` (edit), `POST /po/tasks/:id/regenerate` — ownership +
      `canTransitionTask` + optimistic `rev` guard (409 on conflict). 9 tests.
- [x] **API: source annotations for a task** — `GET /po/tasks/:id/annotations`
      returns `PoSourceAnnotation` (selector, textNote, transcript + status,
      voice/screenshot public URLs, structured) — design "Adnotacje źródłowe"
- [x] **Model: `Task.confidence`** (0–1) from analysis output; `Task.reviewedAt`;
      `Task.rev` optimistic lock (separate from product `version`) — shared type,
      Drizzle schema + migration `0001`, memory + d1 adapters
- [x] **Model: sub-task typing** — `Task.subtaskType` (`backend|frontend|integration|other`); design sub-task chips render it
- [x] Review UI wired (PO panel): state-tab filters, list sorted by AI confidence,
      per-task accept (+auto-advance)/reject/inline-edit/regenerate, source
      annotations w/ voice playback + transcript; rev-conflict surfaced + auto-reload
- [~] **regenerate** = scoped re-analysis of the task's annotations (done); split/merge still pending
- [ ] Rejected task's annotations stay `processed` unless PO explicitly "send back for re-analysis"
- [x] Optimistic locking for concurrent PO edits (`rev`; 409 conflict surfaced in UI)
- [x] State transitions guarded (`canTransitionTask`); immutable statuses (accepted/exported) refuse edit/regenerate
- [ ] Attach/detach screenshots/video; orphan media → cleanup job; optional Kanban view; survive analysis re-runs (analysis already only-inserts)

### Phase 9 — Export  ✅ JSON/CSV shipped (idempotent); Jira/GitHub live push deferred (needs PO creds)
- [x] **JSON / CSV export first** (self-contained, no external creds) — `POST
      /po/tasks/export?format=json|csv`: accepted→exported, stable `speqify:<id>`
      externalId, idempotent full-snapshot re-run; design "Eksportuj N" + CSV button wired (client download). Jira/GitHub live push still below.
- [ ] Re-validate Jira/GitHub credentials at export time (may have expired since "test task")
- [ ] Jira (create-only): issue type, components, versions, field mapping, **sub-tasks/issue links**
- [ ] GitHub Issues: labels, body, **task-list/linked issues**; media as hosted R2 links
- [ ] **Media links = stable long-lived unguessable public R2 URLs** (no link rot in tickets); private-repo privacy tradeoff documented
- [ ] Embed technical context + build/env + repro breadcrumb in ticket body (dev-ready)
- [ ] JSON / CSV export (versioned schema; media as URLs; nested flattened)
- [ ] **Idempotency (externalId map)**; partial-failure resume without duplicates; per-task retry + error display
- [ ] Rate-limit/backoff (incl. GitHub secondary limits); export blocked until referenced media ready
- [ ] **Create-only & frozen**: post-export edits in Speqify do NOT sync (V1) — PO clearly informed

### Phase 10 — Landing page  (see §8 for full spec)
- [x] Convergence tokens → CSS variables (design prototype `Speqify.html` ported verbatim)
- [x] Page sections (benefit bar, header, hero+product mock, problems, how-it-works, features, state machines, compare, privacy/RODO, bottom CTA, footer)
- [x] **PL + EN** locale switch (header toggle, `<html lang>` + title sync, localStorage/?lang)
- [~] **SDK / Get-started section**: design has no dedicated SDK snippet block — landing footer links to (unbuilt) `/docs/sdk`; snippet still lives in PO panel Install. Decide if landing needs the §7.3 SDK section explicitly.
- [ ] WCAG 2.2 AA audit (Lighthouse contrast pass), CWV budget (LCP<2.5s, INP<200ms, CLS<0.1)
- [-] Sticky bottom CTA on mobile — **not in the design prototype**; prototype uses benefit bar + header CTA + bottom email form only (design treated as authority)
- [ ] Responsive QA on real devices

### Phase 11 — Security, privacy, observability
> **Design-derived (Admin Panel prototype):** these turn the SA dashboard's
> representative cards into real data.
- [x] **AI providers as entities** — `GET/PUT /admin/providers`, `PlatformProviderConfig`
      stored + envelope-encrypted key (masked 4-char echo); SA "Dostawcy AI" page +
      Drizzle `platform_config` + migration. (health/p95 live-probe still Phase 11)
- [x] **Admin analytics** — `GET /admin/stats` (live projects/POs/annotations/
      submitted/tasks/accepted/rejected/exported/accept-rate) feeds the 5 stat cards
- [x] **`Project.status`** (`live|paused|archived`) — model + migration + `POST
      /admin/projects/:id/status`, real status pill + SA selector. (env pill stays a URL heuristic — env is not a model field; flagged)
- [x] **Audit log** entity + `GET /admin/audit` + `appendAudit` emitted on
      user/project/panel create+delete, project status, analysis finish, task
      accept/reject, export, lead — design "Ostatnie zdarzenia" live
- [ ] **AI budget / cost guards** per org + alerts (design "Budżet AI") — still representative (token metering = real Phase 11 work)
- [ ] Billing & limits, Webhooks, Org settings, per-project Privacy/retention pages (design nav) — backend + screens
- [x] **SDK ingest: annotation `tags[]`** — `CreateAnnotationInput` + schema +
      Drizzle + migration + memory/d1 persistence; overlay sends them; surfaced in PO source annotations
- [x] **`GET /panels/:token` returns project display name** — overlay status pill uses it (falls back to env host)
- [x] **Landing closed-beta lead endpoint** — `POST /leads` (public CORS) → stored
      + audited; landing form posts best-effort, acknowledgement always shown (locked §11 invite-only)
- [ ] Secrets handling review (no plaintext keys in D1; master key in Secrets Store)
- [ ] CORS lockdown + capability-token revocation tests
- [ ] Rate limiting on ingest + auth endpoints
- [ ] Data retention & deletion policy (audio/screenshots; EU/GDPR) — documented + enforced
- [ ] Workers Logs / Logpush + Sentry wired across API, queue, workflows
- [ ] Load/abuse test of ingest path

### Phase 12 — V2 backlog (out of scope now)
- [-] Source-code indexing / RAG context (additive: Vectorize + Workflow + Containers)
- [-] Real-time HTML modification
- [-] Client portal with status tracking
- [-] Two-way Jira/GitHub status sync
- [-] Task estimation
- [-] Advanced auth / RBAC / multi-PO / admin audit trail

---

## 7. Overlay SDK — distribution & integration

The SDK must be **easy to grab and embed** in our own apps and **easy to find** for
developers. Provide two delivery channels:

### 7.1 Channels
- [ ] **Script loader (CDN)** — versioned, immutable bundle on Workers Static Assets:
      `https://speqify.app/sdk/v1/loader.js` (also `/sdk/latest/` alias for non-prod).
- [ ] **npm package** `@speqify/sdk` — preferred for our own app builds: typed API,
      tree-shakeable, build-time env gating, pinned version.

### 7.2 Embed snippet (documented everywhere it's needed)
```html
<!-- Speqify overlay — load ONLY on non-production / review environments -->
<script
  defer
  src="https://speqify.app/sdk/v1/loader.js"
  data-speqify-token="PANEL_TOKEN"
></script>
```
- [ ] Loader is inert unless: env gate passes (flag / query param / hostname allowlist)
      **and** `data-speqify-token` validates against the API.
- [ ] Token can also arrive via URL (`?speqify=PANEL_TOKEN`) or a Speqify launcher redirect.

### 7.3 Where the SDK is downloadable / discoverable
- [ ] **Landing page**: dedicated "Get the SDK / Install" section with copy-paste snippet,
      version badge, and a link to docs (developer-facing, satisfies the "leave a place to
      download the SDK" requirement).
- [ ] **PO panel**: per-panel "Install" tab showing the exact snippet pre-filled with that
      panel's token + environment-gating guidance + a one-click copy.
- [ ] **Docs page** (`/docs/sdk`): install (CDN + npm), gating, CSP requirements, API,
      changelog, versioning policy.

### 7.4 Host-app requirements (document clearly — these are our apps)
- [ ] CSP allowances on the host app's test env: `script-src` (loader), `connect-src`
      (Speqify API), `img-src`/`media-src` (R2 screenshots/audio if previewed).
- [ ] SDK isolates itself (Shadow DOM, scoped styles, no global leakage).
- [ ] Zero overhead in production (loader not shipped / gated out at build time).

---

## 8. Landing page specification

**Authority:** [`DESIGN.md`](./DESIGN.md) — the *Convergence* design system. Every token,
component, and rule below traces to it. **Conversion + accessibility win over aesthetics.**

**Inspiration:** [usersnap.com](https://usersnap.com/) — closest analog (visual feedback /
bug reporting tool). Borrow: product-led clean utilitarian look, hero with an annotated
product screenshot, integration logo wall, alternating image/text feature blocks, real
testimonials with photos, generous trial CTA. **Do not** copy copy/branding — Speqify's
angle is *requirements gathering on your live app + voice + AI → Jira/GitHub*.

### 8.1 Page architecture (top → bottom, per Convergence "Page architecture")
- [ ] **Benefit bar** (`benefit-bar`, 40px, `primary`): 3–4 concrete benefits, e.g.
      "Annotate on the live app · Voice notes, no typing · AI-drafted Jira/GitHub tickets".
- [ ] **Header** (sticky, 64px): logo (left); visible nav (Product, How it works,
      Integrations, Docs, Pricing) — no desktop hamburger ≥1024px; "Log in" (`button-link`)
      + "Start free" (`button-primary`).
- [ ] **Hero**: outcome-led H1 (e.g. "Turn live-app feedback into shippable tickets"),
      `body-lg` subhead (concrete, named outcome), **one** `button-cta-hero` (`accent`) +
      one `button-secondary` ("See how it works"). Product visual: annotated app
      screenshot showing the overlay (element highlight + voice note + AI task draft).
      Primary CTA above the fold (NN/g 57% rule).
- [ ] **Trust strip**: "Trusted by teams shipping client apps" + real, recognizable logos
      (only when authentic — fabricated seals reduce trust per `DESIGN.md`).
- [ ] **How it works** (3–4 steps, F-pattern, frontloaded keywords): Point & annotate →
      Talk → AI drafts tasks → Export to Jira/GitHub.
- [ ] **Feature blocks** (alternating image/text, `card-elevated` where used):
      (1) Visual annotation on the real app; (2) Voice notes + async sessions;
      (3) AI task generation following your template; (4) One-click export Jira/GitHub/JSON/CSV.
- [ ] **Integrations** section: Jira, GitHub (logos + short value line).
- [ ] **Social proof**: dated testimonials, real photo + name + role; numeric outcomes.
- [ ] **Get the SDK / Install** (developer section): copy-paste snippet (§7.2), version
      badge, link to `/docs/sdk`. Satisfies the SDK-download requirement on the public site.
- [ ] **Repeated bottom CTA**: differentiated label vs hero ("Yes, start collecting feedback").
- [ ] **Footer**: secondary nav, docs, legal/privacy (GDPR), contact.
- [ ] **Sticky mobile CTA** (`sticky-cta-mobile`, 56px) when hero CTA scrolls out of view.

### 8.2 Hard rules (from `DESIGN.md` — non-negotiable)
- [ ] ≤ 2 `accent` elements per viewport; exactly **one** hero CTA per page.
- [ ] WCAG 2.2 AA: 4.5:1 body / 3:1 large+UI; visible 2px focus ring, 3:1 contrast.
- [ ] Tap targets ≥ 48×48px; never state-by-color-alone (icon+text+shape).
- [ ] Inter + system fallback; single-column forms; labels above inputs; mark optional fields.
- [ ] One surface = border **or** shadow, never both; elevation tiers not skipped.
- [ ] No auto-rotating carousel; no icon-only nav; no fake scarcity/urgency.
- [ ] CWV budget: LCP < 2.5s, INP < 200ms, CLS < 0.1. Lighthouse contrast audit passes.

### 8.3 Build
- [ ] Generate CSS custom properties / Tailwind theme from `DESIGN.md` front-matter tokens
      (colors, typography, rounded, spacing, components) — single source of truth.
- [ ] Static build deployed to Workers Static Assets (`apps/landing`).

---

## 9. Cross-cutting concerns

| Concern | Decision |
|---|---|
| Secrets | Platform AI/transcription keys → Secrets Store (SA). Jira/GitHub creds → envelope-encrypted in D1, master key in Secrets Store. Never plaintext. |
| CORS | API ingest accepts only origins in the project's configured environment allowlist. |
| Capability tokens | Unguessable, revocable, scoped to one panel + role + env; per-token rate limit + upload-size cap; optional expiry. |
| Privacy / GDPR | Reviewers consent on first use. Audio/video/screenshot/console = client personal data: scrubbed (auth/secrets stripped, size-capped), documented retention + **right-to-erasure** jobs; EU data residency where supported. |
| Data minimization | Network/console capture toggleable per project; redaction tools; capture-volume caps. |
| Cost guards | Per-project quotas + alerts: transcription, LLM, R2 (video) storage. |
| Traceability | End-to-end `correlationId`: SDK → API → queue → workflow → export. |
| API/SDK contract | Versioned ingest API + SDK compat + deprecation policy (host apps pin loader versions). |
| Account recovery | No email in V1 → SA regenerates PO credentials; SA password rotation invalidates sessions. |
| Resilience / DR | D1 backups; R2 lifecycle; offline-resilient SDK drafts; documented recovery runbook. |
| Auth tradeoffs (accepted) | SA single shared password (no admin audit), reviewer identity = panel role (no per-person identity). Acceptable for V1; revisit on growth. |
| Observability | Structured logs; Logpush; Sentry on API + queue + workflow consumers. |

---

## 10. Accepted decisions & risks (locked)

1. **Integration = embedded SDK** (not iframe, not reverse proxy). Rationale: our own apps;
   same-origin gives full-fidelity selectors/screenshots; sidesteps cross-origin DOM,
   proxy URL-rewriting, and auth/cookie pain.
2. **Token binding** — loader reads token from URL/launcher, validates via API, else dormant.
3. **CORS origin allowlist** — token usable only from project's configured env origins.
4. **Embed gating** — loader active only behind env flag / query param; zero prod overhead.
5. **Screenshot fidelity** — client-side capture (same-origin OK); known `html2canvas` CSS
   caveats; consider `getDisplayMedia` fallback for hard cases.
6. **Minimal auth for V1** — SA single password; PO accounts created by SA; capability URLs
   for reviewers. Accepted; may grow later.
7. **Provider keys** — AI + transcription keys are **platform-level (SA)**; export
   credentials are **per-project (PO)**.
8. **Export V1** — create-only push + JSON/CSV. No two-way status sync (V2).
9. **DB** — D1 + Drizzle (no external Postgres/pgvector; code-indexing dropped removes the
   only reason it was considered).

---

## 11. Open decisions register

> Architecture is decided enough to start **Phase 0–1**. The items below are real
> decisions that block or reshape specific later phases. Each has a recommended default
> so it can be approved quickly.

### P0 — confirm before Phase 0/1 (foundational)
- [x] Cloudflare account + **Workers Paid plan** purchased 2026-05-19 (per-account, shared with other projects). *Correction: Queues are Free since 2026-02-04 and Workflows are Free+Paid — Paid is NOT required for them. Paid is justified by 30s CPU/invocation (Free = 10ms; PBKDF2 auth + analysis JSON parsing risk `1102 exceededCpu`) + headroom. Containers/Dynamic Workers remain Paid-only but are not used in V1.* `speqify.app` domain + billing owner still TODO.
- [ ] Panel app framework: **React + Vite SPA** (recommended) vs Next.js. *Default: React+Vite SPA.*
- [ ] Cardinality PO ↔ Project — affects schema. *Default: a PO may own many projects; a project has exactly one PO (V1).*
- [ ] SA auth modeling in Better Auth. *Default: seeded `superadmin` account, rotatable password, rate-limited.*
- [ ] EU data residency for D1 / R2 (client audio + screenshots = personal data, GDPR). *Default: pin to EU jurisdiction where supported; document retention.*

### P1 — decide before the relevant phase (shapes architecture)
- [ ] **LLM provider + model** for vision task generation + structured-output strategy (JSON mode / tool use). *Default: configurable; one vision-capable default chosen at SA setup; structured output.* (Phase 7)
- [ ] Transcription: validate Workers AI Whisper handles MediaRecorder format (webm/opus) **and target languages incl. Polish**; pick fallback if not. (Phase 6)
- [ ] Screenshot capture mechanism: `html2canvas` vs DOM-snapshot lib vs `getDisplayMedia`. (Phase 5)
- [ ] Selector robustness: rely on generated CSS vs add stable `data-*` attributes to our apps (cross-repo change). *Default: capture multiple strategies + recommend `data-speqify-id` in our apps.* (Phase 5)
- [ ] Reviewer entry mechanism: Speqify launcher redirect vs direct app URL with `?speqify=token`. *Default: launcher link that sets token then redirects.* (Phase 4/5)
- [ ] Voice note constraints (max length, chunked upload, size cap). *Default: ~5 min cap, single upload, server-validated.* (Phase 5/6)

### Product decisions (change scope / landing)
- [ ] **Onboarding model — inconsistency to resolve.** The locked workflow has SA manually
      creating projects + PO accounts → there is **no self-serve signup**. A marketing
      landing with "Start free" misrepresents the product. Decide: invite-only
      internal/agency tool (CTA = "Request access / Book a demo") **or** add a real
      self-serve signup path (new scope). *Default: invite-only; landing CTA = "Request access".*
- [ ] Pricing presence on landing. *Default: omit until model defined.*
- [ ] Notifications in V1 (otherwise PO must manually check panels). *Default: none in V1; backlog.*
- [ ] Docs site location / npm publication target. *Default: docs as route in `apps/landing`; npm private.*

### Biggest risk — de-risk with a spike, not a paper decision
- [ ] **AI task-generation quality.** The product lives or dies on the AI turning
      annotations + transcripts + screenshots + template into *good* grouped tickets —
      currently unproven. **Recommended: pull a focused Phase 7 prototype/spike early**
      on real sample input — **including the auto technical context + host-app build/env**
      (the Usersnap insight: rich automatic context is what makes tickets dev-ready) —
      before committing to the full Review/export build; output quality validates the
      concept and shapes the prompt + template schema.

---

## 13. Adopted from Usersnap research (2026-05-18)

Competitor analysis of Usersnap (help.usersnap.com). **Key insight:** Usersnap's moat is
the *automatic technical envelope* bundled with every screenshot (console, JS errors,
network, env), not the annotation itself — that is what makes tickets dev-ready. Speqify
under-specified this; a same-origin embedded SDK on our own apps makes it cheaper for us
than for Usersnap, and it directly attacks our top risk (AI task quality).

**Adopted into V1** (now tracked in the phases above):
- Auto technical-context capture — Phase 5 / 7 / 9
- Host-app context injection (build/env/user/flags) via SDK init — Phase 5 / 7 / 9
- Action breadcrumb / repro steps — Phase 5 / 7
- Annotation tools: highlight, arrow, blur-redact — Phase 5
- Structured capture prompt (type/severity) — Phase 5 / 7
- Dual screenshot strategy (DOM-render + MediaStream fallback) — Phase 5 (resolves §11 P1)
- Triage: priority + labels (+ optional Kanban) in Review — Phase 8
- **Narrated screen recording** (parallel audio track → reuses transcription) — Phase 5 / 6 / 7 / 9

**Flagged for V1.5 / decision (not yet scheduled):**
- Reply / clarification thread PO ↔ reviewer per annotation (improves input before AI runs)
- Panel-level collection template/type (bug vs general feedback vs QA checklist)

**Confirmed V2 / skipped:** Sentiment Sensor, Opportunities Board + two-way sync (already
V2), widget targeting rules, white-label, NPS/CSAT/email surveys (different product
surface than requirements gathering).

---

## 14. Workflow edge cases & correctness rules

> Full end-to-end review 2026-05-18. **Bold = correctness-critical or legal/privacy
> blocking — these are V1 requirements, not polish.** Each maps back to a phase.

### Access & panels
- [ ] Link revoked / panel closed mid-session with unsent drafts → allow one final Send in a short grace window, else keep drafts locally + mark "panel closed"
- [ ] Origin mismatch (token bound to env A, app served from env B) → SDK refuses + visible dev hint
- [ ] Same link on multiple tabs/devices → ephemeral client id per browser; attributed to panel role; no cross-tab merge
- [ ] **PO account recovery** (no email V1): SA regenerates password; SA password rotation invalidates sessions
- [ ] PO unassigned / project deleted → defined cascade for panels, drafts, tasks, media

### SDK ↔ host app
- [ ] **Capture instrumentation must not break the host app** (safe fetch/console/history patch, coexist with host Sentry/analytics, restore on unload)
- [ ] CSP blocks loader/connect → self-diagnostic + non-prod hint (silent in prod)
- [ ] Shadow DOM / internal iframes → composed-path selector; document cross-origin internal-iframe limit
- [ ] Host session timeout mid-review → **drafts persisted locally (IndexedDB), survive reload/re-login**
- [ ] **Offline / flaky network → local draft queue + idempotent retry; idempotent Send (client ids); server-authoritative time**
- [ ] Large media upload → resumable/multipart + progress + retry; Send never blocks indefinitely
- [ ] Browser support matrix verified (Safari is the risk for getDisplayMedia/MediaRecorder)

### Capture content, privacy & legal
- [ ] **Consent notice on first overlay use** (screen/voice/console/network recorded) + privacy-policy link; localized
- [ ] **Data scrubbing**: strip Authorization/Cookie + secret/token patterns, cap body sizes, console ring-buffer; network/console toggleable per project
- [ ] PII in screenshot/video → blur/redact (screenshots) + recording pause-for-privacy; warn before Send; redaction destructive
- [ ] Capture-volume caps (console/network/breadcrumb) to bound payload + cost

### Screen recording (now V1)
- [ ] `getDisplayMedia` + **parallel mic-audio MediaRecorder** so transcription reuses the voice pipeline (no server-side audio extraction)
- [ ] Controls: start/stop/pause, live duration + **max-length cap**, indicator, preview, re-record
- [ ] Multi-page flow: capture navigation during recording → timeline/breadcrumb
- [ ] Size: bitrate cap + max length + multipart upload; over-limit trimmed/rejected
- [ ] AI uses **transcript + sampled keyframes**, never raw video; full video kept for human review + export link

### Submission & transcription
- [ ] Abandoned drafts excluded from AI; **PO never sees unsent drafts**; TTL garbage-collect
- [ ] **Re-record/edit after transcription started → supersede stale job (versioning); never attach stale transcript**
- [ ] Partial submit → per-annotation status; submission "complete" only when all parts stored
- [ ] Language: template hint + PO override + manual re-run; mixed-language handled
- [ ] Long audio > limit → segment+stitch; empty/silent/low-confidence flagged, not fed as garbage

### AI analysis correctness
- [ ] **Single in-flight run per project** (lock/queue); concurrent triggers queued
- [ ] **Annotation set snapshotted at run start**; mid-run arrivals excluded
- [ ] **Mark `processed` only after tasks durably persisted (transactional)** — failed run leaves annotations re-analyzable, no dupes, no loss
- [ ] Zero annotations → no-op (no LLM call)
- [ ] Large set → map-reduce; images capped + downscaled
- [ ] **Structured-output validation + repair/retry; never persist invalid tasks**
- [ ] **Prompt-injection hardening**: captured content is untrusted data, sandboxed; never executes instructions inside content
- [ ] Provider down/quota/bad key → actionable PO error; idempotent safe re-run
- [ ] Output language enforced = template language even if inputs mixed

### Review & export
- [ ] **New runs never mutate accepted/PO-edited tasks**; only add new
- [ ] Rejected task's annotations stay `processed` unless PO "send back for re-analysis"
- [ ] Concurrent PO edits (multi-tab) → optimistic locking; conflict surfaced
- [ ] Detached/orphan media → retention/cleanup job
- [ ] **Exported-ticket media = stable long-lived unguessable public R2 URLs** (no link rot); private-repo tradeoff documented
- [ ] Subtask mapping per target (Jira sub-tasks/links vs GitHub task-list/linked issues)
- [ ] **Export create-only & frozen**: post-export edits do NOT sync (V1) — PO informed
- [ ] Jira/GitHub rate limits (incl. GitHub secondary) → throttle/backoff; resume w/o dupes
- [ ] Export blocked until referenced media finished processing/upload
- [ ] Re-validate export credentials at export time

### Operational
- [ ] **End-to-end `correlationId`** SDK → API → queue → workflow → export
- [ ] Per-project cost guards/quotas + alerts (transcription, LLM, R2 video storage)
- [ ] **Versioned ingest API + SDK compat contract** + deprecation policy
- [ ] Rate-limit + upload-size cap per capability token; high entropy; optional expiry
- [ ] D1 backup + R2 lifecycle/retention + **GDPR right-to-erasure** jobs; DR runbook

---

## Revision Log

| Date | Author | Change |
|---|---|---|
| 2026-05-18 | — | Initial plan created: locked scope, Cloudflare stack, SDK-embed decision, data model + state machines, phased roadmap, SDK distribution, landing-page spec (Convergence + Usersnap inspiration). |
| 2026-05-18 | — | Expanded §11 into a prioritized open-decisions register (P0/P1/product/AI-spike); flagged onboarding vs landing-CTA inconsistency. |
| 2026-05-18 | — | Usersnap competitor research: added auto technical-context capture, host-app context injection, action breadcrumb, blur/redact + arrow tools, structured capture prompt, dual screenshot strategy, triage priority/labels to Phases 5/7/8/9; added §13. |
| 2026-05-18 | — | Screen recording promoted to V1 (parallel-audio design). Full edge-case review: rewrote Phases 5–9 for correctness/resilience; strengthened §9 (consent, scrubbing, erasure, cost, traceability, API versioning, recovery, DR); added §14 edge-case & correctness reference. |
| 2026-05-18 | — | Implementation Phases 0–6 shipped & pushed (private repo, CI green): monorepo+CI, Convergence landing, D1(EU)+R2 provisioned, core API (Hono/D1/Drizzle), SuperAdmin (backend+UI), PO config (template+encrypted export), panel lifecycle, full overlay SDK 0.5.0 (capture/redaction/recording/offline), transcription logic. 43 tests. Roadmap §6 checkboxes reconciled; deferred items flagged. Manual prerequisites still outstanding: Workers Paid (Queues/Workflows runtime) + LLM provider key (Phase 7 e2e). |
| 2026-05-19 | — | Phase 7 (AI analysis) logic shipped: LLM port + prompt (injection-hardened) + `runAnalysis` with §14 correctness (single in-flight lock, snapshot, structured-output validate+repair, persist-then-process, no mutation of existing tasks); `POST /po/analyze` + `GET /po/tasks`. 47 tests, cloud-free. §6 Phase 7 reconciled. |
| 2026-05-19 | — | Panel UI rebuilt on Convergence: extracted tokens to shared `@speqify/tokens` (landing re-exports; §8.3 single source), Tailwind in panel, app shell (sidebar + hash-routed subpages), role-branched SA/PO, accessible buttons (fixed dark-on-dark hover) + labelled forms. Phase 3 PO UI delivered (Overview/Template/Export+Test/Tasks). Added CORS for the SPA↔API cross-origin (real Phase 2/3 gap) + Node dev server. Phases 2/3 reconciled. |
| 2026-05-19 | — | **Cloudflare plan correction + transcription queue runtime.** Verified against current CF docs: Queues on Free since 2026-02-04; Workflows on Free+Paid — neither was ever a Workers-Paid gate (plan premise was stale, lines 165/220/228/238/426 corrected). Workers Paid purchased anyway (per-account; rationale: 30s CPU/invocation vs Free 10ms for PBKDF2 auth + analysis JSON parsing, + headroom). Wired Phase 6 Queue runtime: producer pokes `TRANSCRIPTION_QUEUE` on panel submit; `queue()` consumer runs idempotent `runOnce` sweep; manual `POST /admin/transcribe/run` kept as backstop. Provisioned `speqify-transcription` queue. |
| 2026-05-19 | — | **Phase 8 (PO review) core shipped + verified.** Model: `Task.confidence`/`subtaskType`/`reviewedAt`/`rev` (shared type + zod + Drizzle + migration `0001` + memory/d1 adapters); `PoSourceAnnotation` + `TaskEditInput` contracts. Analysis: structured-output `confidence`+`subtaskType` (schema/service/prompt). API: `GET /po/tasks/:id`, `GET /po/tasks/:id/annotations`, `POST .../accept|reject|regenerate`, `PUT /po/tasks/:id` — ownership + `canTransitionTask` + optimistic `rev` (409) + immutable-status guards. Panel PO review wired: confidence-sorted list w/ bars, detail meta pewność, inline edit form, source annotations (voice playback + transcript), accept auto-advance, conflict auto-reload; dev-server seeded w/ demo review queue (offline). 33 API tests (9 new) + 18 SDK + 5 shared green; all typechecks + builds green; verified live (PO login → list/detail/source-annotations → Accept → state+list update). Plan §6 Phase 7/8 reconciled. |
| 2026-05-19 | — | **Tranches B/C/D shipped + verified (turn design "representative" data into real).** **B — SA dashboard real data:** `Project.status` (model+migration+`POST /admin/projects/:id/status`+pill+selector); `GET /admin/stats` live aggregates → 5 stat cards; append-only audit log (`audit_log` table, `appendAudit` on user/project/panel/status/analysis/task/export/lead, `GET /admin/audit`); `PlatformProviderConfig` entity (`platform_config` table, `GET/PUT /admin/providers`, envelope-encrypted key + 4-char masked echo, new SA "Dostawcy AI" page). **C — Phase 9 export:** `POST /po/tasks/export?format=json|csv`, accepted→exported with stable `speqify:<id>` externalId, idempotent full-snapshot re-run, "Eksportuj N"+CSV buttons wired to client download. **D — cross-cutting:** annotation `tags[]` end-to-end (schema/Drizzle/migration/memory+d1/overlay send/PO source-annotation surface); `GET /panels/:token` returns project name (overlay pill); public `POST /leads` (CORS *, stored+audited) + landing form best-effort post. Migrations `0001–0003` + journal. 45 API tests (16 new across B/C/D) + 18 SDK + 5 shared green; all typechecks + landing/panel builds + SDK IIFE bundle green; verified live (SA dashboard live stats/status/providers/audit; PO accept→export json/csv→`exported`; lead 201; tags persisted). §6 Phases 9/11 reconciled. Remaining: AI budget metering, billing/webhooks/org-settings/privacy screens, Jira/GitHub live push. |
| 2026-05-19 | — | **Plan expanded with design-derived requirements + Phase 8 build started.** Folded the gap report into the roadmap: Phase 7 (+task `confidence`), Phase 8 (concrete review endpoints, source-annotation endpoint, `Task.confidence/version/subtaskType`, wired accept/reject/edit/regenerate), Phase 9 (JSON/CSV-first export), Phase 11 (AI-provider entities, `/admin/stats`, `Project.status`, audit log, AI budget, billing/webhooks/privacy screens, ingest `tags[]`, panel-token project name, landing lead endpoint). Implementation underway, vertical-slice + tested per tranche. |
| 2026-05-19 | — | **Design handoff implemented (Claude Design bundle → treated as requirements).** Ported 4 prototypes pixel-faithfully: SDK overlay rebuilt (`packages/sdk/src/overlay.ts` — status pill + dark toolbar + 440px right panel w/ Nowa adnotacja/Sesja/Kontekst tabs; all capture preserved; on-page accent pin via document-level style; +JetBrains Mono token w/ system fallback). Panel rebuilt on the Admin/PO design (dark sidebar, role-pill SA=accent/PO=muted, project/org selector, icon nav groups, topbar+env, Page layout helper, `icons.tsx`); SA dashboard (5 stats + projects table + AI providers + budget + audit), PO two-pane review queue (state-tab filters + task list + rich detail: Opis/AC G-W-T/metadane+sub-taski/adnotacje źródłowe/eksport podgląd); design-only routes are honest Placeholder pages. Landing fully rebuilt **PL+EN** (i18n module, header lang switch, `<html lang>`/title sync) with the full design (benefit bar→hero+product mock→problems→how→features→state machines→compare→privacy→bottom CTA→footer). JetBrains Mono via Google-Fonts `<link>` (panel+landing); Inter stays bundled. All typechecks + 18 SDK tests + landing/panel `vite build` + SDK IIFE bundle green; landing PL/EN switch and SA/PO shells verified live against the seeded dev API. Panel UI copy is Polish to match the design (design = authority); code/identifiers stay English. **Design-vs-impl gaps surfaced** (designs now requirements): PO accept/reject/edit/regenerate + AI-confidence + source-annotation playback/transcript + sub-task type (Phase 8); review→export action (Phase 9); SA AI-provider entities + analytics/sparklines/project-status + budget/audit/billing/webhooks/org-settings/GDPR retention (Phase 7 cfg / 11); annotation-level tags not in ingest schema; landing closed-beta form has no lead backend (locked §11 invite-only); `Project` lacks env/status fields (env pill heuristic); `GET /panels/:token` exposes no project display name (overlay uses env host). Phase 10 partially reconciled. |
