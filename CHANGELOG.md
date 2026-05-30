# Changelog

All notable changes to Speqify are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims for
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Cross-browser & distribution
- **Firefox build (MV3):** dedicated `build:firefox`/`zip:firefox` — drops the Chromium-only
  `sidePanel` permission, adds `browser_specific_settings.gecko` (id + `strict_min_version`
  128.0), and opens the panel via Firefox's `sidebar_action` (Alt+S = `_execute_sidebar_action`).
- **Opera build:** `build:opera`/`zip:opera` — a Chromium build that emits `sidebar_action`
  instead of `side_panel` (Opera has no `chrome.sidePanel`).
- Forced **Manifest V3** on every target (WXT defaulted Firefox/Opera to MV2).
- Reproducible **AMO source bundle** (`zip.sourcesRoot` = monorepo root).

### Docs & assets
- **Privacy policy** — `PRIVACY.md` + a public `/privacy.html` page, linked from the landing footer.
- **Store kit** under `apps/extension/store/`: `PUBLISHING.md` (build + per-store publish/update
  steps), `edge-addons-listing.md`, a 300×300 logo, promo tiles, and 1280×800 screenshots.

### Landing
- Marketing site is now **responsive** (mobile / tablet / desktop).

### Fixes & cleanup
- The advertised **Alt+Shift+S "Stop & attach"** shortcut now works (it was listed in
  Settings but had no handler).
- Removed dead code found in review: `TRACKER_LABELS`, the `IconName` type, the
  `SPEQIFY_CANCEL_PICK` message type, and the unread `ActiveRecorder.displayStream` field.
- De-duplicated the icon/logo PNG generators into a shared `scripts/icon-mark.mjs`.

## [0.1.0] — 2026-05-30

First public (open-source) release.

### Capture
- Side-panel capture on any page (Alt+S): **screen recording** (current tab,
  drag-to-select area, picked DOM element, or whole window) **or a single screenshot**.
- The **microphone is the input switch**: on → dictate (your voice is transcribed and
  the AI drafts the ticket); off → you fill the form yourself (screenshot/recording goes
  straight to an editable form).
- Automatic context: a **reproduction-step timeline** (clicks, inputs, key presses,
  scrolls, navigation) plus **console / JS errors** and **failed network requests**,
  shown in the Review screen and embedded in the issue (each group toggleable).
- Optional **screen-recording upload** to trackers that can host it.

### AI — local-first, bring-your-own
- **On-device default:** Whisper (speech→text) + Qwen3 (drafting) via Transformers.js /
  ONNX Runtime Web (WebGPU). Nothing leaves the browser.
- **Chrome built-in Gemini Nano** used for drafting where available, with
  JSON-schema-constrained output.
- **Any OpenAI-compatible endpoint:** OpenAI directly, OpenRouter (for hosted Claude or
  Gemini), or a local server (Ollama, LM Studio, llama.cpp).

### Trackers
- Create issues directly in **GitHub Issues, Jira, Linear, or GitLab** from the browser
  (no proxy server — the extension's host permissions bypass CORS), with screenshot and
  recording attachments where the tracker supports them.

### Privacy & security
- Captured context is **redacted before it leaves the browser** — URL query strings and
  fragments are stripped and common secret shapes (Bearer/JWT/`sk-`/`ghp_`/`AKIA…`) scrubbed.
- Configured endpoints are validated: a key/token is only attached over **HTTPS** (or to
  `localhost`). Secret-bearing form fields are masked during reproduction capture.
- **No backend, no accounts** — tracker tokens and AI keys live only in
  `chrome.storage.local`. See [`SECURITY.md`](./SECURITY.md).
