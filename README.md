# Speqify

Turn rough notes into well-structured tickets — and push them straight to your
tracker — without leaving the page you're on.

Speqify is a **browser extension**: open the side panel on any web app, describe
a bug or feature in plain language, optionally grab a screenshot and the page's
console / network errors, let AI rewrite it into a structured ticket, then submit
it to **GitHub Issues, Jira, Linear, or GitLab** in one click.

## Run in a container (Dev Container)

Develop without installing npm packages on your host — install/build happen in a
container, deps live in a volume. Config: [`.devcontainer/devcontainer.json`](./.devcontainer/devcontainer.json).

**Prereqs:** Docker or rootless Podman + the VS Code *Dev Containers* extension
(or [`@devcontainers/cli`](https://github.com/devcontainers/cli)). Podman:
`"dev.containers.dockerPath": "podman"` / `--docker-path podman`.

```bash
devcontainer up --workspace-folder . --docker-path podman   # builds + pnpm install (frozen)
devcontainer exec --workspace-folder . bash

# inside the container:
pnpm ext:build    # build the MV3 extension → apps/extension/.output/
pnpm landing:dev  # landing (vite) → http://localhost:5173
pnpm dev          # everything (turbo)
pnpm audit
```

**Or with `podman compose`** (see [`compose.yaml`](./compose.yaml)):
```bash
podman compose run --rm install     # deps (frozen lockfile)
podman compose run --rm ext-build   # extension → apps/extension/.output/
podman compose up landing-dev       # landing → http://localhost:5173
podman compose run --rm build
podman compose run --rm audit
```

**Browser-extension boundary:** build the extension *inside* the container, but
**load the unpacked extension and run the browser on your HOST**
(`chrome://extensions` → *Load unpacked* → the built `.output/` on the mounted
workspace). The browser is not in the container — that's intentional.

**Hardening:** `--cap-drop=ALL`, `--security-opt no-new-privileges`, non-root user,
deps in a named volume (host stays clean), no host secrets mounted.

> **No backend, no accounts.** Your tracker tokens and AI keys live only in your
> browser (`chrome.storage.local`). Nothing is sent to a Speqify server — there
> isn't one.

## Why an extension

Trackers (Jira, Linear, GitLab) block direct browser calls via CORS. A browser
extension with host permissions is exempt from CORS, so it can talk to those APIs
directly — no proxy server required.

## Pluggable AI

Bring whatever model you want:

- **Cloud, BYO key** — OpenAI, Anthropic (Claude), or Google Gemini.
- **Local model** — any OpenAI-compatible endpoint (Ollama, LM Studio, Jan,
  llama.cpp). Fully offline, no key, no cloud.
- **Chrome built-in AI** — on-device Gemini Nano (optional, where available).

## Monorepo layout

```
apps/
  extension/   # The browser extension — WXT + React 19 + Tailwind v4 (MV3)
  landing/     # Marketing site — Vite + React + Tailwind + Motion
packages/
  core/        # Ticket schema (zod), AI provider abstraction, tracker adapters
```

## Toolchain

- Node `>=22`, pnpm `9.15`, Turborepo
- TypeScript (strict), ESLint (flat config), Prettier
- Extension: [WXT](https://wxt.dev) (Vite-native, cross-browser MV3)

## Common commands

```bash
pnpm install          # install all workspaces
pnpm ext:dev          # run the extension in dev (loads into Chrome)
pnpm ext:build        # production extension build (.output/)
pnpm ext:zip          # zip for the Web Store
pnpm landing:dev      # landing dev server
pnpm typecheck        # typecheck all
pnpm lint             # lint all
```

## Loading the extension (dev)

```bash
pnpm ext:dev
```

WXT launches a Chrome instance with the extension loaded. To load a build
manually: `chrome://extensions` → enable Developer mode → **Load unpacked** →
select `apps/extension/.output/chrome-mv3`.
