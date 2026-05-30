# Publishing & updating Speqify

Step-by-step guide to **building** the extension and **publishing / updating** it on each
store. Per-store listing copy and permission justifications live in
[`edge-addons-listing.md`](./edge-addons-listing.md) (the Edge kit also applies almost
verbatim to Chrome).

> **Browser support today**
> - **Chrome, Edge, Brave, Arc** → the **`chrome`** build (`chrome-mv3`). Brave & Arc install
>   from the Chrome Web Store; Edge has its own store.
> - **Firefox** → the **`firefox`** build (`firefox-mv3`), submitted to AMO.
> - **Opera** → ⚠️ not shippable yet (needs a Chromium build that emits `sidebar_action`
>   instead of `side_panel`; Opera has no `chrome.sidePanel`). See the bottom of this file.
> - **Safari** → requires macOS + Xcode (blocked on a Linux host). Out of scope here.

---

## 0. One-time setup (accounts)

| Store | Where | Cost |
|---|---|---|
| Chrome Web Store | <https://chrome.google.com/webstore/devconsole> | **$5 one-time** registration |
| Microsoft Edge Add-ons | <https://partner.microsoft.com/dashboard/microsoftedge> | free |
| Firefox (AMO) | <https://addons.mozilla.org/developers/> | free |
| Opera Add-ons | <https://addons.opera.com/developer/> | free |

You also need, hosted publicly (all stores ask for it because the extension uses the
microphone and sends data to third-party trackers):

- **Privacy policy URL** → deploy the landing, then use `https://<landing-domain>/privacy.html`
  (source: `apps/landing/public/privacy.html`, also `PRIVACY.md`).
- **Store logo** `apps/extension/store/logo-300.png` (300×300).
- **Screenshots** `apps/extension/store/screenshots/*.png` (1280×800).

---

## 1. Bump the version (do this before EVERY store update)

Stores reject an upload whose version is **not strictly higher** than the published one.

1. Edit `version` in `apps/extension/package.json` (e.g. `0.1.0` → `0.1.1`). WXT copies it
   into the generated `manifest.json` for every browser.
2. Add an entry to `CHANGELOG.md`.
3. Use [semver](https://semver.org): patch for fixes, minor for features, major for breaking.

> The version is shared across all stores — keep them in lockstep so a given version number
> means the same build everywhere.

---

## 2. Build the packages (in the container)

All builds run in the hardened container; the host stays clean (see the repo README).

```bash
# from the repo root (Speqify/)
podman compose -f compose.yaml run --rm shell bash -lc '
  corepack enable pnpm
  pnpm --filter @speqify/extension zip          # → Chrome / Edge / Brave / Arc
  pnpm --filter @speqify/extension zip:firefox  # → Firefox (+ sources zip)
'
```

Artifacts land in `apps/extension/.output/`:

| File | For |
|---|---|
| `speqifyextension-<ver>-chrome.zip` | Chrome Web Store, Edge Add-ons (same zip) |
| `speqifyextension-<ver>-firefox.zip` | Firefox / AMO |
| `speqifyextension-<ver>-sources.zip` | AMO source upload (see §5 caveat) |

**Always verify before uploading** (must be green):

```bash
podman compose -f compose.yaml run --rm shell bash -lc '
  corepack enable pnpm
  pnpm --filter @speqify/extension typecheck
  pnpm --filter @speqify/extension lint
'
```

**Smoke-test the build locally (on your HOST browser, not the container):**

- Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → enable **Developer mode** →
  **Load unpacked** → `apps/extension/.output/chrome-mv3`. Open with the toolbar icon / Alt+S.
- Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick
  `apps/extension/.output/firefox-mv3/manifest.json`. The panel opens in the **sidebar**
  (left); Alt+S toggles it.

---

## 3. Chrome Web Store

### First publish
1. <https://chrome.google.com/webstore/devconsole> → **Add new item**.
2. Upload `speqifyextension-<ver>-chrome.zip`.
3. **Store listing:** name, summary, detailed description, **category** (Developer Tools),
   **screenshots** (1280×800 or 640×400), language. Reuse the copy from
   `edge-addons-listing.md`.
4. **Privacy practices:** single-purpose description, justify each permission and
   `<all_urls>` (text in `edge-addons-listing.md`), declare data use, **Privacy policy URL**.
5. **Submit for review** (usually hours–days).

### Update
1. Bump version (§1) and rebuild (§2).
2. Dev console → the item → **Package** → **Upload new package** → the new `chrome.zip`.
3. Adjust listing/notes if needed → **Submit for review**. Live after approval.

---

## 4. Microsoft Edge Add-ons

The **same `chrome.zip`** is used. Full field-by-field walkthrough is in
[`edge-addons-listing.md`](./edge-addons-listing.md).

### First publish
1. <https://partner.microsoft.com/dashboard/microsoftedge> → **Create new extension**.
2. Upload `speqifyextension-<ver>-chrome.zip`.
3. **Availability → Properties → Privacy → Store listings** — fill in per the kit
   (category, permission justifications, remote-code = **No**, data usage, **Privacy policy
   URL**, description ≥250 chars, **logo 300×300**, screenshots 1280×800).
4. **Notes for certification** (test steps + `<all_urls>` justification — in the kit).
5. **Publish.** Certification can take **up to 7 business days**.

### Update
1. Bump version (§1), rebuild (§2).
2. Partner Center → the extension → **Packages** → upload new `chrome.zip`.
3. **Publish** (notes optional). Re-certified before going live.

---

## 5. Firefox (addons.mozilla.org / AMO)

### First publish
1. Build `zip:firefox` (§2).
2. <https://addons.mozilla.org/developers/> → **Submit a New Add-on** → choose **listed**
   (public on AMO) or **unlisted** (self-distributed signed XPI).
3. Upload `speqifyextension-<ver>-firefox.zip`.
4. **Source code is required** (the build is bundled/minified, uses onnxruntime-web). See
   the caveat below.
5. The add-on **id** is fixed by `browser_specific_settings.gecko.id`
   (`speqify@8cells.dev`) — **permanent**, do not change it later.
6. Listing details (summary, description, category, screenshots) + submit. Review can take
   days.

> **⚠️ Source-upload caveat (pnpm monorepo).** `wxt zip -b firefox` emits a `sources.zip`,
> but WXT's `zip.downloadPackages` can't pack pnpm `link:` workspace deps
> (`@speqify/core`, `@speqify/ui`), so that sources zip alone is **not** reproducible by an
> AMO reviewer. Before an AMO submission, do one of:
> - set `zip.sourcesRoot` in `wxt.config.ts` to the **monorepo root** (with excludes for
>   `node_modules`, `.output`, `dist`, `.git`) so the sources zip contains the whole repo; or
> - upload a zip/tarball of the repo with a README: `pnpm install` then
>   `pnpm --filter @speqify/extension zip:firefox`, Node ≥22, pnpm 9.15, and confirm the
>   rebuilt `firefox.zip` matches.

### Self-distribution (no public listing)
Sign an unlisted XPI you host yourself (needs AMO API creds from the Developer Hub):

```bash
podman compose -f compose.yaml run --rm shell bash -lc '
  corepack enable pnpm && cd apps/extension &&
  pnpm dlx web-ext sign --channel=unlisted \
    --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET" \
    --source-dir .output/firefox-mv3
'
```

### Update
1. Bump version (§1), rebuild `zip:firefox` (§2).
2. AMO → the add-on → **Upload New Version** → new `firefox.zip` (+ source per the caveat).
3. Submit. (Same `gecko.id`; version must be higher.)

---

## 6. Opera Add-ons — ⚠️ not ready

Opera does **not** implement `chrome.sidePanel`; it uses its own `sidebarAction`. The
current `chrome.zip` installs in Opera but the panel never opens, and the Firefox gecko
build isn't a Chromium package Opera accepts. **To ship Opera, first add a Chromium build
variant that emits `sidebar_action`** (WXT only special-cases that for `-b firefox`, so it
needs manual per-target manifest work), then submit at
<https://addons.opera.com/developer/>. Tracked as a follow-up.

---

## 7. Safari — macOS only

Out of scope on a Linux host. Requires macOS + Xcode 26 +
`xcrun safari-web-extension-converter` + an Apple Developer account, plus re-homing the
side panel (no sidePanel in Safari) and mp4 (not webm) recording. See the cross-browser
notes for the full plan.

---

## Pre-submit checklist (every release)

- [ ] Version bumped in `apps/extension/package.json` + `CHANGELOG.md` updated
- [ ] `typecheck` + `lint` green; build smoke-tested unpacked
- [ ] Privacy policy URL live and current
- [ ] Assets ready: logo 300×300, screenshots 1280×800
- [ ] Permission / `<all_urls>` justifications still accurate
- [ ] Correct zip per store (`chrome.zip` for Chrome/Edge, `firefox.zip` for AMO)
