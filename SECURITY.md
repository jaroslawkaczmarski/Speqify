# Security policy

Speqify is a browser extension that handles your tracker tokens, AI keys, and the
contents of the pages you file issues about. This document explains the threat
model and how to report problems.

## Reporting a vulnerability

Please **do not** open a public issue for security reports. Email
**jarek.pl@gmail.com** with a description and steps to reproduce. You'll get an
acknowledgement within a few days; please allow reasonable time for a fix before
public disclosure.

## What data Speqify handles, and where it goes

- **No backend.** There is no Speqify server — nothing is sent to us, ever.
- **Tracker tokens & AI keys** live in `chrome.storage.local`, **unencrypted**
  (standard for MV3 — the browser profile is the trust boundary). Use
  minimally-scoped tokens and revoke them on shared or compromised machines.
- **Captured page context** (page URL, console/network errors, observed steps,
  screenshot, optional voice note / screen recording) flows like this:
  - **Local AI tier (default):** transcription (Whisper) and drafting (Qwen3 or
    Chrome's Gemini Nano) run entirely on-device — the context never leaves the browser.
  - **Remote endpoint tier:** the recorded audio and a redacted page-context digest
    are POSTed to the OpenAI-compatible endpoint **you** configure, to transcribe + draft.
  - **On submit:** the redacted context is embedded in the tracker issue you create.
    You can toggle individual groups (console/network errors, steps) off in the Review screen.
- **Redaction (defense-in-depth).** Before any context leaves the browser it passes a
  best-effort redaction step (`packages/core/src/redact.ts`): URL query strings and
  fragments are stripped, and common secret shapes (`Bearer …`, JWTs, `sk-`/`ghp_`/`AKIA…`)
  are scrubbed. This is not a guarantee — **review the draft before sending.**
- **Input capture.** Reproduction-step capture masks `password` fields plus fields whose
  `autocomplete`/`name`/`id` look sensitive (one-time codes, card numbers, etc.). Other
  field values are still recorded as steps — avoid capturing on pages with secrets, or
  turn off "Record reproduction steps."

## Permissions

- `host_permissions: <all_urls>` and content scripts on all pages are required so the
  extension can (a) call tracker APIs cross-origin — the whole reason it's an extension
  and not a web app — and (b) observe the console/network errors that already happened
  when you start a capture. The content scripts only buffer locally and relay to the side
  panel; nothing is transmitted off-device except as described above.
- Configured AI/tracker endpoints are validated: a token or key is only attached over
  **HTTPS** (or to `localhost`).

## Supported versions

Pre-1.0: only the latest commit on `main` is supported.
