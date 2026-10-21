---
name: release-extension
description: Build and package the Speqify browser extension for the web stores — decide the x.y.z version bump from the changes since the previous store release, run the asset prebuild, build, and zip (Chrome/Edge, Firefox + sources, Opera) in the container, then report the artifact paths. Use when the user runs `/release-extension` or asks to build/package/release/ship the extension or produce a store zip.
disable-model-invocation: true
---

# /release-extension

Produce submittable extension zips in `apps/extension/.output/` via WXT, with a version bump.
The `assets` step (ONNX Runtime copy + icon gen) runs automatically before build/zip — don't
skip it. Full per-store steps: `apps/extension/store/PUBLISHING.md`.

## Args

```
/release-extension              # decide the bump from the changes (see step 1)
/release-extension minor        # override: patch | minor | major | <explicit x.y.z>
```

## Version rule

Every store release bumps the user-visible version `x.y.z`, decided from what changed since the
previous store release:

- `z` (patch): bug fixes only, including performance and small polish.
- `y` (minor): new features; resets `z` to 0.
- `x` (major): big global changes (redesign, new product direction, changes that break old data
  or accounts); resets `y` and `z`.

The version is shared by all stores (keep them in lockstep) and must be strictly higher than the
published one, or the store rejects the upload.

## Workflow

1. **Bump version.** Read the current `version` from `apps/extension/package.json` (WXT copies
   it into every generated `manifest.json`); never assume a value. Review the changes since the
   previous store release (`CHANGELOG.md`, Git history) and apply the rule above, unless the user
   passed an explicit level or version. Keep it valid semver and add a `CHANGELOG.md` entry.
2. **Verify it's green first** in the container (podman when installed and working, otherwise
   docker): `podman compose run --rm install`, then `podman compose run --rm check` (oxlint +
   typecheck + Vitest, the same run as `.githooks/pre-push`). Don't package a failing build.
3. **Build + zip** in the container:
   `podman compose run --rm shell bash -lc "corepack pnpm ext:zip && corepack pnpm ext:zip:firefox && corepack pnpm ext:zip:opera"`
   (each runs `assets` → `wxt build` → `wxt zip`). For a debug build without zipping,
   `podman compose run --rm ext-build` → `apps/extension/.output/chrome-mv3/`.
4. **Confirm the artifacts** in `apps/extension/.output/`: `speqifyextension-<ver>-chrome.zip`
   (Chrome Web Store, Edge), `speqifyextension-<ver>-firefox.zip` +
   `speqifyextension-<ver>-sources.zip` (AMO), `speqifyextension-<ver>-opera.zip`. Each is
   non-trivial in size; spot-check that the manifest version matches the bump.
5. **Report** the old → new version with the reason for the bump level, and the zip paths. (Build
   artifacts — `.output/`, `*.zip` — are gitignored; commit only the version bump and changelog.)
   Uploading to the stores is a manual/authenticated step outside this skill; report built,
   uploaded, submitted and published separately.
