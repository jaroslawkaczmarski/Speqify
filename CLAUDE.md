# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Speqify** — a browser extension (MV3) that turns rough notes into well-structured issue tickets
and submits them straight to GitHub Issues / Jira / Linear / GitLab. Users open a side panel
(Alt+S), describe a bug/feature, optionally attach screenshots, voice, or page context (console /
network / errors / element picker), and AI rewrites it into a structured ticket. **No backend, no
accounts** — tracker tokens and AI keys live only in `chrome.storage.local`. AI is BYO-key:
OpenAI / Anthropic / Google, any OpenAI-compatible local endpoint (Ollama, LM Studio, …), Chrome's
built-in Gemini Nano, or on-device Transformers.js (ONNX Runtime Web).

**Stack:** pnpm 9.15 + Turborepo · Node ≥22 · TypeScript (strict) · React 19 · WXT (extension) ·
Vite (landing) · Zustand · Tailwind v4 · Vitest.

## Monorepo layout

| Path | Role | Framework |
|---|---|---|
| `apps/extension` | The MV3 extension — background, side panel, options, content scripts | WXT + React |
| `apps/landing` | Marketing site | Vite + React |
| `packages/core` | Domain logic: `Ticket`/Zod schema, AI provider dispatch (`callModel`/`enhanceTicket`), tracker adapters (github/jira/linear/gitlab), capture context. Only dep is `zod`. Has the Vitest tests. | plain TS |
| `packages/ui` | Shared icons + Tailwind design tokens (`tokens.css`) | React |

Dependency flow: `extension → core + ui`, `landing → ui`, `core` is standalone.

## Commands

```bash
pnpm install
pnpm dev | pnpm build | pnpm lint | pnpm typecheck | pnpm test   # all via turbo
pnpm format            # prettier --write .

# Extension (filtered to @speqify/extension)
pnpm ext:dev           # WXT dev — launches Chrome with the extension loaded
pnpm ext:build         # → apps/extension/.output/chrome-mv3/
pnpm ext:zip           # → .output/speqify.zip  (Web Store submission)
pnpm landing:dev

# Single package / single test
pnpm --filter @speqify/core test
```

Turbo task graph (`turbo.json`): `build`/`zip`/`typecheck`/`test` all `dependsOn: ["^build"]`
(workspace deps build first); `dev` is `persistent`, non-cached.

## Extension specifics

- **WXT** generates the MV3 manifest from `apps/extension/wxt.config.ts`. Permissions:
  `sidePanel, activeTab, scripting, storage, tabs` + `host_permissions: ["<all_urls>"]` (host access
  is what lets it call tracker APIs directly, bypassing CORS — that's the whole reason it's an
  extension and not a web app). CSP includes `'wasm-unsafe-eval'` so ONNX Runtime can run on-device.
- Entry points (`src/entrypoints/`): `background.ts` (service worker), `sidepanel/` (main React UI),
  `options/` (settings, opens as a tab), `capture.content.ts` (buffers console/network/errors, the
  element picker) and `inject.content.ts` (hooks `console`/`fetch`/`XHR`/errors, relays via
  `window.postMessage`).
- **Pre-build asset step (`pnpm assets`)** runs before every dev/build/zip: `scripts/copy-ort.mjs`
  copies ONNX Runtime Web's `.wasm`/`.mjs` into `public/ort/` (must be same-origin under the CSP),
  and `scripts/gen-icons.mjs` generates the icon set. Don't skip it.
- State: a Zustand store (`src/store.ts`) persisted to `chrome.storage.local`, with a safe fallback
  when not running inside an extension.

## Conventions

Strict TS from `tsconfig.base.json` (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, etc.; `ui`
relaxes `verbatimModuleSyntax` for re-exports). ESLint flat config (`eslint.config.js`), Prettier
(width 100, double quotes). Dev container builds inside the container, but **load the unpacked
extension on the host browser** (the browser isn't in the container).

## Skills — note before adding

This repo's **`.gitignore` ignores `.claude/`** (line 27), so a `.claude/skills/` folder would
**not** ship with the code. To commit project-local skills, first narrow the ignore, e.g.:

```gitignore
.claude/*
!.claude/skills/
```
