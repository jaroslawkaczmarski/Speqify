# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Speqify** — a browser extension (MV3) that turns a screen recording + voice note into a
well-structured issue ticket and submits it straight to GitHub Issues / Jira / Linear / GitLab.
Users open a side panel (Alt+S), pick a capture source, record the screen while narrating, and AI
transcribes + drafts the ticket; the page context (console / network / errors / observed
reproduction steps / screenshot / picked element) is attached. **No backend, no accounts** —
tracker tokens and AI keys live only in `chrome.storage.local`.

**AI is local-first.** The default runs entirely on-device with Transformers.js / ONNX Runtime Web
(Whisper for speech-to-text + a small Qwen3 instruct model — 0.6B/1.7B ONNX — for drafting; nothing downloads until
the user opts into a tier in Settings). The alternative is a **remote OpenAI-compatible endpoint**
the user supplies as a URL + key (OpenAI, OpenRouter, Ollama, or any compatible gateway): drafting
via `/chat/completions`, optional transcription via `/audio/transcriptions`. There is no separate
Anthropic/Google/Chrome provider path — use OpenRouter for hosted Claude/Gemini.

**Stack:** pnpm 9.15 + Turborepo · Node ≥22 · TypeScript (strict) · React 19 · WXT (extension) ·
Vite (landing) · Zustand · Tailwind v4 · Vitest.

## Monorepo layout

| Path | Role | Framework |
|---|---|---|
| `apps/extension` | The MV3 extension — background, side panel, options, content scripts | WXT + React |
| `apps/landing` | Marketing site | Vite + React |
| `packages/core` | Domain logic: `Ticket`/Zod schema, capture context types (incl. `ReproStep`), AI text helpers (`buildContextDigest`, `extractJson`, `describeStep` — NOT a model client), tracker adapters (github/jira/linear/gitlab) with screenshot embedding + `SCREENSHOT_EMBED`. Only dep is `zod`. Has the Vitest tests. | plain TS |
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
  `options/` (settings, opens as a tab), `capture.content.ts` (buffers console/network/errors +
  observed reproduction steps, the element picker and the drag-to-select area picker, streams live
  click coords during a capture) and `inject.content.ts` (hooks `console`/`fetch`/`XHR`/errors,
  relays via `window.postMessage`).
- **AI layer (`src/ai/`)** is the real model client (core has none): `local.ts` (Transformers.js
  Whisper + Qwen, WebGPU), `remote.ts` (OpenAI-compatible chat + transcription), `prompt.ts`
  (`buildDraftSystem`/`buildDraftUser` — honors `autoLabels`, `translateTo`, and injects per-type
  Templates), `index.ts` (`draftTicket`/`transcribeAudio`). Edit AI behaviour here, not in core.
- **Recording (`src/panel/recorder.ts`)** honors the source picker: `quality`→height constraint,
  `tab`/`area`/`element`→`preferCurrentTab`, `window`→raw surface. For `area`/`element` (and for
  click rings when cursor highlight is on) frames are piped through a canvas to crop + draw rings;
  crop/ring coordinate mapping assumes a current-tab capture.
- **Drafts** (`src/panel/drafts-db.ts`) persist paused captures — including the recorded video
  Blob — in **IndexedDB** (`speqify`/`drafts`), too big for `chrome.storage`.
- **Pre-build asset step (`pnpm assets`)** runs before every dev/build/zip: `scripts/copy-ort.mjs`
  copies ONNX Runtime Web's `.wasm`/`.mjs` into `public/ort/` (must be same-origin under the CSP),
  and `scripts/gen-icons.mjs` generates the icon set. Don't skip it.
- State: a Zustand store (`src/store.ts`) persisted to `chrome.storage.local` (tracker, AI config,
  capture defaults, editable per-type ticket `templates`), with a safe fallback when not running
  inside an extension.

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
