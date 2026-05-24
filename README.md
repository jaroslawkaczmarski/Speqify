# Speqify

Turn rough notes into well-structured tickets — and push them straight to your
tracker — without leaving the page you're on.

Speqify is a **browser extension**: open the side panel on any web app, describe
a bug or feature in plain language, optionally grab a screenshot and the page's
console / network errors, let AI rewrite it into a structured ticket, then submit
it to **GitHub Issues, Jira, Linear, or GitLab** in one click.

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
