# Review Sessions refactor — branch handoff

**Branch:** `feat/review-sessions` (do not push to `main` until the whole
series is green; CI is wired to deploy-on-push for main, branch pushes
are safe)

**Pick up from RS-3** unless instructed otherwise. See "Pickup
instructions" at the bottom.

---

## Why we're doing this

The PO confirmed a substantial product pivot — SDK installs safely
**everywhere including production** but is **dark by default**. UI only
appears when the URL carries an `?speqify_session=<sess>&speqify_reviewer=<rev>`
pair. The Product Owner creates ReviewSessions in the admin panel,
invites real Reviewers (name + email), and the system mails magic-link
URLs containing both tokens. A welcome modal shows the PO-authored
session description + RODO consent on first visit, then the bottom dock
becomes the primary UX. The right (440px) panel collapses by default
and is opened on demand from a dock button. Task templates split per
type: `bug` / `change` / `feature` / `polish`.

This makes the representative screens from bundle 2 (PO Sessions /
Session detail / New Session / Reviewers / SDK Idle welcome / Accept
Invite) **real**.

## Locked decisions (do not re-ask)

1. **Drop `Panel` entirely.** No "install token". The SDK install is
   project-agnostic; identity is `session token + reviewer token` in
   URL only. The previous `Panel`/`PanelAudience`/`PanelStatus` types
   and their tables are gone.
2. **Email via Resend.** `RESEND_API_KEY` will be a Worker secret;
   sender domain `noreply@speqify.app` requires DNS records — manual.
   If the key is unset, addReviewer returns the invite URL in the
   response body so the PO can copy/paste (graceful fallback).
3. **Task types:** `bug`, `change`, `feature`, `polish` — all four.
4. **Slicing:** one big PR (this branch). No commits to `main` until
   the whole series typechecks + tests + builds clean.

## State of play

| File set | Status |
|---|---|
| `packages/shared` (types/schemas/states) | ✅ committed in `8e4a5e4` (RS-1) |
| `packages/db` (Drizzle schema + migration 0004) | ✅ committed in `039dd0b` (RS-2) |
| `apps/api` (repo, endpoints, email) | ⏳ pending RS-3..RS-5 |
| `packages/sdk` (loader + overlay rewrite) | ⏳ pending RS-6 |
| `apps/panel` (Sessions UI rewire + per-type templates) | ⏳ pending RS-7 |
| Tests + analysis prompt + ship | ⏳ pending RS-8 |

Prod state at branch creation: 1 project, 1 user, 1 panel (unused),
**0 annotations, 0 submissions, 0 tasks, 0 runs**, OpenRouter already
wired (commit `e7a5942` on main, `claude-haiku-4.5` configured via
`/admin/providers`). Migration 0004 drops + rebuilds annotations,
submissions, panels because they're empty.

## RS-3 — Repository methods (memory + D1)

**Goal:** make the type-system green on `apps/api/src/repo/*` after
RS-1+RS-2 broke it. The Repository interface and both adapters need
session/reviewer methods and to stop referencing Panel/PanelAudience.

Files:
- `apps/api/src/repo/types.ts`
- `apps/api/src/repo/memory.ts`
- `apps/api/src/repo/d1.ts`

Methods to **drop**:
- `getPanelByToken`, `createPanel`, `listPanels`, `setPanelStatus`,
  `deletePanel`, everything Panel-shaped.

Methods to **add** (suggested signatures — adapt to existing style):
- `createReviewSession(input: { projectId, name, description,
  instructions, envUrl, startsAt, endsAt, createdBy, token }): Promise<ReviewSession>`
- `getReviewSession(id: Id): Promise<ReviewSession | null>`
- `getReviewSessionByToken(token: string): Promise<ReviewSession | null>`
- `listReviewSessionsByProject(projectId: Id): Promise<ReviewSession[]>`
- `updateReviewSession(id: Id, patch: Partial<...>): Promise<ReviewSession | null>`
- `setReviewSessionStatus(id, status): Promise<ReviewSession | null>`
- `addReviewer(input: { sessionId, name, email, token }): Promise<Reviewer>`
- `getReviewer(id: Id): Promise<Reviewer | null>`
- `getReviewerByToken(token: string): Promise<Reviewer | null>`
- `listReviewersBySession(sessionId: Id): Promise<Reviewer[]>`
- `revokeReviewer(id: Id): Promise<Reviewer | null>` (status → declined)
- `markReviewerAccepted(id: Id): Promise<Reviewer | null>` (called on
  first SDK welcome accept; idempotent)
- `markReviewerSeen(id: Id, at: IsoTimestamp): Promise<void>`

Existing `getOrCreateSubmission` + `upsertAnnotation` + `completeSubmission`
must be updated to take `sessionId` + `reviewerId` instead of `panelId`.
Annotation creation must derive `correlationId` etc. as before, but the
ingest path now resolves session/reviewer from server-side token
validation (not client-supplied).

The in-memory adapter currently holds `panels`/`submissions`/`annotations`
maps keyed by panel-derived keys. Re-key by session+reviewer+clientId.

## RS-4 — API endpoints

**Goal:** replace `/panels/*` with `/sdk/*` + add `/admin/sessions/*`.

Files:
- `apps/api/src/app.ts` (Hono routes)
- `apps/api/src/middleware.ts` (if it exists, or routes inline) — new
  helper to resolve `sessionToken+reviewerToken` from query/header into
  the request context (similar to `requireRole`)

Drop:
- All `/panels/:token/...` and `/admin/projects/:id/panels` and
  `/admin/panels/:panelId/...`

Add:
- `GET /admin/projects/:id/sessions` (list)
- `POST /admin/projects/:id/sessions` (create — uses
  `createReviewSessionSchema`; generates `token` via `newSecretToken()`)
- `GET /admin/sessions/:id` (detail, including reviewers list)
- `PATCH /admin/sessions/:id` (`updateReviewSessionSchema`)
- `POST /admin/sessions/:id/status` (`reviewSessionStatusSchema`,
  enforce `canTransitionReviewSession`)
- `POST /admin/sessions/:id/reviewers` (`inviteReviewerSchema`; generates
  reviewer token; calls Resend; returns URL too as fallback)
- `DELETE /admin/sessions/:id/reviewers/:rid` (revoke)
- `POST /admin/sessions/:id/reviewers/:rid/resend` (re-send email)
- `GET /sdk/sessions/:sessionToken/intro` — public; requires query
  `?reviewer=<reviewerToken>`; validates both, marks reviewer accepted,
  returns `SdkSessionIntro`. CORS: `*` (any host).
- `POST /sdk/submissions/:submissionId/annotations` — body =
  `createAnnotationSchema`; auth = `X-Speqify-Session` + `X-Speqify-Reviewer`
  headers; CORS: `*`.
- `POST /sdk/submissions/:submissionId/complete` — finalize batch.
- `POST /sdk/uploads` — port the existing requestUpload flow to the new
  auth model.

Audit log entries: `session.created`, `session.published`,
`session.closed`, `reviewer.invited`, `reviewer.revoked`,
`reviewer.accepted`, `annotation.submitted`.

For PO routes (`/po/*`): tasks endpoints stay as-is; the
`/po/tasks/:id/annotations` resolver continues to return
`PoSourceAnnotation` shape (no schema change there).

## RS-5 — Resend email

**Files (new):**
- `apps/api/src/email/resend.ts`
- `apps/api/src/email/templates.ts` (invitation HTML)

`Env` extends with `RESEND_API_KEY?: string`. The email service is
optional — if the key is missing, `sendInvitation()` resolves with
`{ sent: false, link }` and the route response includes the link so the
PO can copy/paste. Bullet-proof for not requiring the key to ship.

Template should be plain HTML, no external CSS, dark-mode-aware. Subject:
`Zaproszenie do sesji review · {projectName}`.

Domain setup is a manual step (DNS records for SPF/DKIM at the Resend
dashboard). Document in DEPLOYMENT.md when RS-5 lands.

## RS-6 — SDK loader + overlay rewrite

**Files:**
- `packages/sdk/src/loader.ts` (drop data-speqify-token reading; read
  ONLY `?speqify_session=` + `?speqify_reviewer=` from URL; if either
  missing → do nothing, no DOM injected)
- `packages/sdk/src/index.ts` (init signature change)
- `packages/sdk/src/client.ts` (POST to `/sdk/...` with new headers)
- `packages/sdk/src/overlay.ts` (welcome modal pulls
  `/sdk/sessions/:t/intro`; render session description + instructions in
  the consent modal alongside the existing RODO disclosure)
- `packages/sdk/src/outbox.ts` (carry session+reviewer tokens through
  retry persistence)

UX rebalance:
- Bottom dock = primary. After welcome accept, the dock is the only
  thing visible by default.
- Right panel (`.sp-panel`) hidden; opened only by the last dock button
  (rename to "Szczegóły" / "Details") and dismissable.
- Dock gains a primary **"Wyślij"** button — currently sending is only
  reachable through the right panel.
- Mic click → element-pick auto-engages → reviewer speaks → tap stop →
  annotation auto-drafts → "Wyślij" sends. Aim for 4 taps total + voice.

Keep the SDK Idle minimized FAB code we already have — it stays as the
"collapsed" state of the active overlay (not the install-time dark
state, which is now achieved by simply not rendering anything).

## RS-7 — Panel UI

**Files:**
- `apps/panel/src/api.ts` — drop panel endpoints; add session/reviewer
  endpoints
- `apps/panel/src/pages-po.tsx` — `PoSessions` / `PoSessionDetail` /
  `PoNewSession` / `PoReviewers` from representative → real. Drop
  `RepBanner` references for these. Wire data to new API.
- `apps/panel/src/pages-po.tsx` — `PoTemplate` becomes 4 tabs
  (Bug/Change/Feature/Polish), each with the current single-template
  form; `PUT /po/project/template` accepts the full
  `ProjectTemplates` map.
- `apps/panel/src/pages-sa.tsx` — `AdminProject` Panels tab disappears
  (or repurpose as "Active sessions"). Remove the install-snippet card
  (no install token anymore — SDK install is generic).
- `apps/panel/src/App.tsx` — drop `Panels` route + remove from SA nav.
  Drop `AcceptInvite` (the email link now goes directly to the host
  app, not the panel).

## RS-8 — Tests, analysis, ship

- `apps/api/test/api.test.ts` — rewrite the panel/audience-shaped
  fixtures + tests around session/reviewer. Add mock Resend (no-op).
- `apps/api/src/analysis/service.ts` + `prompt.ts` — pick the right
  template from `project.templates[taskType]` at prompt-build time.
  Analysis output JSON gains a `taskType: TaskType` field; the
  classifier defaults to `bug` if AI omits it.
- Local full gate: typecheck × all, tests × all, prettier --check,
  vite build × panel+landing, sdk build.
- Apply migration `0004` to remote D1 once series is green:
  `npx wrangler d1 execute speqify --remote --file
  packages/db/migrations/0004_review_sessions_and_reviewers.sql`
- Open PR `feat/review-sessions → main`. Let CI run. Merge when green.
  Deploy workflow auto-redeploys.
- Smoke-test: SA creates a session, invites a reviewer, opens the
  generated URL → welcome modal shows → adds an annotation → PO runs
  analyze → OpenRouter generates a task using the matching per-type
  template.

## Pickup instructions for a fresh session

1. Read this file (`RS-NOTES.md`) first.
2. `git checkout feat/review-sessions` (already pushed to origin).
3. Verify state:
   ```
   git log --oneline main..HEAD          # expect: 8e4a5e4 + 039dd0b
   pnpm --filter @speqify/shared typecheck   # green
   pnpm --filter @speqify/db typecheck       # green
   pnpm --filter @speqify/api typecheck      # currently RED — that's
                                             #   expected, fix in RS-3
   ```
4. Start RS-3 (Repository methods). Make `apps/api` typecheck green by
   the end of RS-3 → RS-4 (endpoints) → RS-5 (email) → RS-6 (SDK) →
   RS-7 (panel UI) → RS-8 (tests + analysis + PR).
5. Local gate between phases: `pnpm --filter @speqify/<changed> typecheck`.
6. Commit at the end of each RS-N with the `refactor/feat(scope/RS-N): …`
   convention used here.
7. Don't push to main mid-series — push to the feature branch only.
   Final PR + merge happens in RS-8.

## Operational notes for the picker-upper

- SuperAdmin login (prod): `jarek.pl@gmail.com / Sp!ZmVJjM42qiXvj9GmrAy8xwc3aMy9`
- OpenRouter is wired (`claude-haiku-4.5` via `/admin/providers`,
  configured commit `e7a5942` on main). Migration 0004 leaves
  `platform_config` row alone, so the AI config survives the schema
  rebuild.
- Resend account does **not** yet exist. RS-5 implementation can ship
  without it (fallback returns link); document the domain-setup step in
  DEPLOYMENT.md when ready.
- Production URLs (live):
  - Landing: `https://speqify.app`
  - Panel: `https://admin.speqify.app`
  - API: `https://api.speqify.app`
- CI/Deploy workflow (`.github/workflows/deploy.yml`) is **path-agnostic
  on main**, so the merge of this branch will trigger a full prod
  redeploy. After merge, also run the D1 migration command above —
  it's a separate manual step (the deploy workflow doesn't touch D1).
