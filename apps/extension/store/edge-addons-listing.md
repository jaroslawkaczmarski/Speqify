# Microsoft Edge Add-ons — submission kit

Ready-to-paste material for publishing Speqify to **Edge Add-ons** (Microsoft Partner
Center) on the existing Chromium MV3 build. **No code changes needed for Edge** — Edge
114+ supports the `sidePanel` API, so the current build is fully functional.

> **Opera does NOT belong here.** Opera does not implement `chrome.sidePanel` (it uses its
> own `sidebarAction` API), so this build installs but the panel never opens in Opera.
> Opera needs the same `sidebar_action` port as Firefox — see the bottom of this file.

## Package

- File: `apps/extension/.output/speqifyextension-0.1.0-chrome.zip` (~9.6 MB)
- Rebuild: `podman compose -f compose.yaml run --rm shell bash -lc "corepack enable pnpm && pnpm --filter @speqify/extension zip"`
- Manifest version: 3 · extension version: 0.1.0
- The same zip is the one used for the Chrome Web Store; nothing Edge-specific is required.

## Step 5 — Properties

| Field | Value |
|---|---|
| **Category** | Developer tools |
| **Website** | (landing URL once public) |
| **Support contact** | https://github.com/jaroslawkaczmarski/Speqify/issues |
| **Mature content** | No |

## Step 6 — Privacy

**Single Purpose Description**
> Speqify lets you capture an element/screenshot/recording and a voice or typed note on any
> web page, drafts a structured issue from it (locally or via your own AI endpoint), and
> submits it to your configured tracker (Jira, GitHub, Linear, or GitLab).

**Permission justification** (one box per manifest permission)

| Permission | Justification |
|---|---|
| `sidePanel` | The entire Speqify UI is a side panel that opens next to the page you're filing an issue about; this permission registers and opens that panel. |
| `activeTab` | Read the active tab's URL/title for issue context and capture a screenshot of the visible tab when the user starts a capture. |
| `tabs` | Identify the current tab/window to target the capture and `captureVisibleTab`. |
| `scripting` | Inject the capture content script (element/area picker, console/network/error collector, reproduction-step recorder) into the current tab **on demand** when the user starts a capture. |
| `storage` | Persist user settings locally (selected tracker, AI config, capture defaults, editable ticket templates). Nothing leaves the browser. |
| `host_permissions: <all_urls>` | (1) The user can capture and file an issue from **any** page, so the capture script must be injectable on any origin. (2) The extension calls the user's tracker REST APIs (Jira/GitHub/Linear/GitLab, **including self-hosted instances at arbitrary domains**) and an optional user-supplied OpenAI-compatible AI endpoint **directly** — host permissions exempt these from CORS, which is the reason Speqify is an extension and not a web app. No browsing data is collected or sent to us. |

> Microphone is **not** a manifest permission — Edge prompts at use time when the user
> turns the mic on to dictate. Mention in the justification box for `<all_urls>` or in
> certification notes: audio is transcribed locally and discarded; it is optional.

**Are you using remote code?** → **No.** All executable code, including the ONNX Runtime /
Transformers.js WASM used for on-device AI, is bundled in the package and served
same-origin. The optional remote AI endpoint and the tracker APIs are **data** (REST)
calls, not executable code.

**Data usage** → Speqify has no backend and collects no analytics/telemetry. We collect
**no** personal data. Content the user creates (issue text, screenshots, recordings,
tracker tokens, AI keys) is stored locally in the browser and transmitted **only** to the
third-party services the user explicitly configures (their tracker; optionally their AI
endpoint). Certify the "limited use" disclosures.

**Privacy Policy URL** → ⚠️ **REQUIRED** (the extension accesses the microphone and
transmits user-authored content/credentials to third-party services). A public privacy
policy page must exist and be linked here. *(Action item — not yet hosted.)*

## Step 7 — Store listing (en-US)

**Extension name:** `Speqify`

**Short description** (read-only — comes from manifest `description`):
> Talk to your tracker — capture any element, record your voice, and ship a structured issue to Jira, GitHub, Linear, or GitLab.

**Description** (min 250, max 10 000 chars):
> Speqify turns a rough note — typed or spoken — into a well-structured issue and ships it straight to your tracker, without leaving the page you're on.
>
> Open the side panel on any web app, capture what's wrong, and Speqify drafts a clean ticket and submits it to GitHub Issues, Jira, Linear, or GitLab in one click.
>
> • Capture a screenshot, a screen recording, a dragged area, or a picked DOM element.
> • Describe it your way: type it, or turn the mic on and dictate — Speqify transcribes your voice and the AI drafts the title, description, type, and labels.
> • Context comes for free: the page URL, console & network errors, and a reproduction-step timeline (clicks, inputs, scrolls, navigation) are captured and attached — so the ticket is actually actionable.
>
> No backend, no accounts. Your tracker tokens and AI keys live only in your browser. Nothing is sent to a Speqify server — there isn't one.
>
> AI is local-first: transcription and drafting can run entirely on your device (Whisper + a small Qwen model via WebGPU, with a WASM fallback). Prefer the cloud? Point Speqify at any OpenAI-compatible endpoint (OpenAI, OpenRouter, Ollama) with your own key.
>
> Free and open source under the MIT license. No telemetry by default.

**Search terms** (≤7 terms, ≤21 words total, ≤30 chars each):
`bug report`, `issue tracker`, `Jira`, `GitHub issues`, `Linear`, `screen recorder`, `voice to ticket`

**Assets**

| Asset | Spec | Status |
|---|---|---|
| Extension logo | 1:1, 300×300 (min 128×128) PNG | ⚠️ to produce (have 128px icon; need 300×300) |
| Screenshots | up to 6, **exactly** 1280×800 or 640×480 | ⚠️ to capture (real side-panel shots) |
| Small promo tile | 440×280 (optional) | optional |
| Large promo tile | 1400×560 PNG (optional) | optional |
| YouTube URL | optional | — |

*(Polish `pl` listing is optional — duplicate assets, translate the Description.)*

## Step 8 — Notes for certification

> No account is required to install or use Speqify. To exercise issue submission, paste a
> personal access token for any supported tracker in Settings (e.g. a GitHub PAT with
> `repo` scope) — there are no Speqify test credentials because there is no Speqify backend.
> Open the UI by clicking the toolbar icon or pressing Alt+S; it opens a side panel.
> On-device AI is **opt-in**: the user must choose a model tier in Settings before any model
> downloads; alternatively configure a remote OpenAI-compatible endpoint. The microphone is
> optional and only used when the user enables dictation; audio is transcribed locally and
> discarded. `<all_urls>` is used to inject the capture script on the current page and to
> call tracker/AI APIs directly (CORS bypass) — no browsing data is collected.

Certification can take **up to 7 business days**.

---

## Opera (NOT covered by this build)

Opera does **not** support `chrome.sidePanel`; it exposes its own `sidebarAction` API. The
current `chrome-mv3` build will install in Opera but the toolbar click won't open anything.
To ship Opera, do the Firefox `sidebar_action` port first (it covers Opera too), then
submit at https://addons.opera.com. Tracked with the Firefox plan in memory
`speqify-cross-browser-status`.
