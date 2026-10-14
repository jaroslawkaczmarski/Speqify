---
name: test-core
description: Run the Speqify @speqify/core Vitest suite — the ticket schema, AI text helpers (JSON extraction, step descriptions), and tracker formatting (Markdown, Jira ADF, screenshot embedding). Use when the user runs `/test-core`, or after changing anything in packages/core, to confirm the domain logic still passes.
disable-model-invocation: true
---

# /test-core

`packages/core` holds the testable domain logic: the Zod `Ticket` schema, AI text helpers in
`ai/enhance.ts` (`extractJson`, `describeStep`, `buildContextDigest` — not a model client; model
calls live in `apps/extension/src/ai/`), redaction helpers, and tracker adapters
(`submitTicket`, `composeMarkdown`, `composeAdf`, `SCREENSHOT_EMBED`). It's the only package with a
Vitest suite (`packages/core/src/core.test.ts`).

## Args

```
/test-core                 # run once
/test-core watch           # watch mode
/test-core <pattern>       # filter to matching test names
```

## Workflow

1. **Run** in the container (podman when installed and working, otherwise docker; run
   `podman compose run --rm install` first if deps are missing):
   `podman compose run --rm shell bash -lc "corepack pnpm --filter @speqify/core test"` (this is
   `vitest run`). For watch mode use `corepack pnpm --filter @speqify/core exec vitest`; for a name
   filter add `-t "<pattern>"`.
2. **On failure**, show the failing test names and the assertion diff; the usual culprits are the
   `TicketSchema` shape or a tracker adapter's payload mapping (`trackers/*.ts`, ADF for Jira).
3. **Also run** `corepack pnpm --filter @speqify/core typecheck` (same container) when types might
   be implicated (strict TS: `noUncheckedIndexedAccess` etc.).
4. **Report** pass/fail counts and any failing cases. If a change spans the extension too, suggest a
   follow-up `corepack pnpm typecheck` across the workspace.
