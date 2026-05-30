# Speqify

Turn a rough note — typed or spoken — into a well-structured issue and ship it
straight to your tracker, without leaving the page you're on.

Speqify is a **browser extension** (Manifest V3). Open the side panel (**Alt+S**) on any
web app, capture what's wrong, and it drafts a clean ticket and submits it to
**GitHub Issues, Jira, Linear, or GitLab** in one click.

- **Capture** a screenshot, a screen recording, a dragged area, or a picked DOM element.
- **Describe it your way:** type it yourself, or turn the mic on and dictate — Speqify
  transcribes your voice and the AI drafts the title, description, type, and labels.
- **Context comes for free:** the page URL, console & network errors, and a
  reproduction-step timeline (clicks, inputs, scrolls, navigation) are captured and
  attached — so the ticket is actually actionable. The recording is uploaded too, on
  trackers that can host it.

> **No backend, no accounts.** Your tracker tokens and AI keys live only in your browser
> (`chrome.storage.local`). Nothing is sent to a Speqify server — there isn't one.
> See [SECURITY.md](./SECURITY.md).

## AI — local-first, bring your own

Transcription and drafting default to running **entirely on your device**; reach for a
cloud endpoint only if you want to.

- **On-device (default):** Whisper (speech→text) + a small Qwen3 model (drafting) via
  [Transformers.js](https://github.com/huggingface/transformers.js) / ONNX Runtime Web
  (WebGPU). Offline, no key — nothing leaves the browser.
- **Chrome built-in AI:** uses on-device **Gemini Nano** for drafting where available.
- **Any OpenAI-compatible endpoint:** OpenAI directly, **OpenRouter** (for hosted Claude
  or Gemini), or a local server (Ollama, LM Studio, llama.cpp). You supply the URL + key.

Captured context is redacted — URL query strings stripped, common token shapes scrubbed —
before it's sent to a remote model or embedded in an issue.

## Why an extension

Trackers (Jira, Linear, GitLab) block direct browser calls via CORS. A browser extension
with host permissions is exempt from CORS, so it can talk to those APIs directly — no
proxy server required.

## Monorepo layout

```
apps/
  extension/   # The MV3 browser extension — WXT + React 19 + Tailwind v4
  landing/     # Marketing site — Vite + React
packages/
  core/        # Ticket schema (zod), capture-context types, AI text helpers + redaction, tracker adapters
  ui/          # Shared icons + design tokens
```

## Toolchain

- Node `>=22`, pnpm `9.15`, Turborepo
- TypeScript (strict), ESLint (flat config), Prettier
- Extension: [WXT](https://wxt.dev) (Vite-native, cross-browser MV3)

## Develop in a container (recommended)

Install/build happen **inside a container**, deps live in a volume — your host stays
clean. Use Docker or rootless Podman.

```bash
# devcontainer CLI (see .devcontainer/devcontainer.json)
devcontainer up --workspace-folder . --docker-path podman   # build + pnpm install (frozen)
devcontainer exec --workspace-folder . bash

# …or podman compose (see compose.yaml)
podman compose run --rm install     # deps (frozen lockfile)
podman compose run --rm ext-build   # extension → apps/extension/.output/chrome-mv3
podman compose up landing-dev       # landing → http://localhost:5173
podman compose run --rm audit       # pnpm audit
```

**The browser runs on your HOST, not in the container.** Build the extension inside the
container, then load the unpacked output on the host (below). Hardening: `--cap-drop=ALL`,
`--security-opt no-new-privileges`, non-root, deps in a named volume, no host secrets mounted.

## Common commands

```bash
pnpm install          # install all workspaces
pnpm ext:dev          # run the extension in dev (launches Chrome with it loaded)
pnpm ext:build        # production extension build → apps/extension/.output/chrome-mv3
pnpm ext:zip          # zip for the Web Store
pnpm landing:dev      # landing dev server
pnpm -r typecheck     # typecheck all · pnpm -r lint · pnpm --filter @speqify/core test
```

> In the container, run `corepack enable pnpm` first if `pnpm` isn't on PATH.

## Loading the extension

`chrome://extensions` → enable **Developer mode** → **Load unpacked** →
`apps/extension/.output/chrome-mv3`. (`pnpm ext:dev` does this for you in a dev profile.)

## Contributing & license

[CONTRIBUTING.md](./CONTRIBUTING.md) · [SECURITY.md](./SECURITY.md) ·
[CHANGELOG.md](./CHANGELOG.md). Licensed under the [MIT License](./LICENSE).
