# Speqify

Collect requirements directly on your live app — annotate UI, record voice notes, and let
AI draft structured Jira / GitHub tickets following your project's template.

> **Status:** Phase 0 (scaffolding). See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
> for the full roadmap and [`DESIGN.md`](./DESIGN.md) for the Convergence design system
> (landing-page authority).

## Monorepo layout

```
apps/
  landing/   # Marketing site — Convergence design system (Vite + React + Tailwind)
  panel/     # SuperAdmin + Product Owner app (Vite + React)        [skeleton]
  api/       # Hono Worker: REST API, ingest, export                [skeleton]
packages/
  shared/    # Domain types, zod schemas, state machines (single source of truth)
  db/        # Drizzle schema + D1 migrations                       [skeleton]
  sdk/       # Overlay SDK (loader + overlay UI)                    [skeleton]
```

## Toolchain

- Node `>=22`, pnpm `9.15.0`, Turborepo
- TypeScript (strict), ESLint (flat config), Prettier, Vitest
- Hosting: Cloudflare (Workers, D1, R2, Queues, Workflows, AI Gateway)

## Common commands

```bash
pnpm install          # install all workspaces
pnpm dev              # run dev tasks (turbo)
pnpm --filter @speqify/landing dev    # landing dev server
pnpm build            # build all
pnpm lint             # lint all
pnpm typecheck        # typecheck all
pnpm format           # prettier write
```

## Cloudflare resources

Resource provisioning (D1 / R2 / Queues / Secrets Store) requires `wrangler login` and is
**not** committed. `wrangler.toml` files contain placeholder bindings — fill IDs after
creating resources. See `IMPLEMENTATION_PLAN.md` §6 Phase 0.
