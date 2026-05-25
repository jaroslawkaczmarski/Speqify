---
name: release-extension
description: Build and package the Speqify browser extension for the Web Store — bump the extension version, run the asset prebuild, build, and zip, then report the artifact path. Use when the user runs `/release-extension` or asks to build/package/release/ship the extension or produce a Web Store zip.
disable-model-invocation: true
---

# /release-extension

Produce a submittable extension zip (`apps/extension/.output/speqify.zip`) via WXT, with a
version bump. The `assets` step (ONNX Runtime copy + icon gen) runs automatically before
build/zip — don't skip it.

## Args

```
/release-extension              # patch bump (default)
/release-extension minor        # one of: patch | minor | major | <explicit x.y.z>
```

## Workflow

1. **Bump version** in `apps/extension/package.json` (`version`, currently `0.0.0`) per the arg.
   Keep it valid semver — this becomes the MV3 manifest `version`.
2. **Verify it's green first:** `pnpm --filter @speqify/extension typecheck` and `pnpm lint`
   (or `/test-core` for the domain logic). Don't package a failing build.
3. **Build + zip:** `pnpm ext:zip` (runs `assets` → `wxt build` → `wxt zip`). For a debug build
   without zipping, `pnpm ext:build` → `apps/extension/.output/chrome-mv3/`.
4. **Confirm the artifact:** `apps/extension/.output/speqify.zip` exists and is non-trivial in size;
   spot-check that the manifest version matches the bump.
5. **Report** the new version and the zip path. (Build artifacts — `.output/`, `*.zip` — are
   gitignored; commit only the `package.json` version bump.) Uploading to the Chrome Web Store is a
   manual/authenticated step outside this skill.
