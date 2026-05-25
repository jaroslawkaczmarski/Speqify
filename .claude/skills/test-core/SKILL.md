---
name: test-core
description: Run the Speqify @speqify/core Vitest suite — the ticket schema, AI provider dispatch, and tracker adapters (github/jira/linear/gitlab). Use when the user runs `/test-core`, or after changing anything in packages/core, to confirm the domain logic still passes.
disable-model-invocation: true
---

# /test-core

`packages/core` holds the testable domain logic (Zod `Ticket` schema, `callModel` /
`enhanceTicket`, tracker adapters). It's the only package with a Vitest suite
(`packages/core/src/core.test.ts`).

## Args

```
/test-core                 # run once
/test-core watch           # watch mode
/test-core <pattern>       # filter to matching test names
```

## Workflow

1. **Run** `pnpm --filter @speqify/core test` (this is `vitest run`). For watch mode use
   `pnpm --filter @speqify/core exec vitest`; for a name filter add `-t "<pattern>"`.
2. **On failure**, show the failing test names and the assertion diff; the usual culprits are the
   `TicketSchema` shape or a tracker adapter's payload mapping (`trackers/*.ts`, ADF for Jira).
3. **Also run** `pnpm --filter @speqify/core typecheck` when types might be implicated (strict TS:
   `noUncheckedIndexedAccess` etc.).
4. **Report** pass/fail counts and any failing cases. If a change spans the extension too, suggest a
   follow-up `pnpm typecheck` across the workspace.
