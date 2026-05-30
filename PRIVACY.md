# Privacy Policy

_Last updated: 2026-05-30_

Speqify is a browser extension that turns a note — typed or spoken — into a structured
issue and submits it to your issue tracker. **Speqify has no backend and no user accounts.**
We do not operate any servers, we do not collect analytics or telemetry, and **none of your
data is ever sent to us** — there is nothing to send it to.

This policy explains what data Speqify handles, where it stays, and the only cases in which
data leaves your browser.

## The short version

- **No Speqify servers, no accounts, no telemetry by default.**
- Your settings, tracker tokens, and AI keys are stored **only in your browser**.
- The only data that leaves your browser goes **directly to services you configure
  yourself** — your issue tracker, and (optionally) an AI endpoint you choose.
- The microphone is used **only** when you turn dictation on; audio is transcribed and then
  discarded.

## What Speqify stores, and where

All of the following is stored locally on your device and never transmitted to us:

- **Settings** (selected tracker, AI configuration, capture defaults, editable ticket
  templates) — in the browser's extension storage (`chrome.storage.local`).
- **Tracker tokens and AI API keys** that you enter — in the browser's extension storage.
  They are used only to authenticate the requests you trigger.
- **Drafts**, including any screen recording you pause — in the browser's IndexedDB. These
  stay on your device until you submit or delete the draft.

Uninstalling the extension removes this local data.

## What Speqify accesses

- **The page you are on**, when you start a capture: the URL and title, an optional
  screenshot or screen recording, console and network errors, and a reproduction-step
  timeline (clicks, inputs, scrolls, navigation). This is assembled into the issue you are
  creating and is shown to you before anything is sent.
- **The microphone**, only if you enable dictation. Audio is transcribed (on-device by
  default) and then discarded — Speqify does not store or upload raw audio.

## The only data that leaves your browser

Speqify sends data only to the third-party services **you** explicitly configure, and only
when you act:

1. **Your issue tracker** — Jira, GitHub, Linear, or GitLab (including self-hosted
   instances at a domain you provide). When you click to create an issue, Speqify sends the
   ticket content (and, where supported, the screenshot/recording) to that tracker's API
   using the token you provided. Your use of that tracker is governed by **its** privacy
   policy.
2. **An AI endpoint you choose (optional).** By default, transcription and drafting run
   **entirely on your device** (Whisper + a small Qwen model via WebGPU/WASM). If you
   instead configure a remote OpenAI-compatible endpoint (e.g. OpenAI, OpenRouter, Ollama),
   the text/audio needed for drafting or transcription is sent to **that** endpoint with
   your key. Captured context is redacted (query strings stripped, common token shapes
   scrubbed) before it is sent or embedded.

On-device AI models are downloaded from a public model host (Hugging Face) only after you
opt into a model tier in Settings.

Speqify is not a party to any of these transfers beyond initiating the request you asked
for in your browser; it receives no copy of the data.

## Permissions

- **Host access (`<all_urls>`)** lets the capture script run on any page you choose to file
  an issue from, and lets Speqify call your tracker/AI APIs directly (browsers otherwise
  block these cross-origin calls via CORS). It is **not** used to monitor your browsing — no
  browsing history or page data is collected or transmitted to us.
- **Side panel / tabs / scripting / storage** are used to show the Speqify UI, read the
  current tab for context, inject the on-demand capture script, and persist your settings
  locally.

## Children

Speqify is a developer tool and is not directed to children under 13.

## Changes

If this policy changes, the "Last updated" date above will change. Material changes will be
noted in the extension's changelog.

## Contact

Questions or requests: open an issue at
<https://github.com/jaroslawkaczmarski/Speqify/issues>.

Speqify is open source under the MIT license; you can read exactly what it does in the
source code.
