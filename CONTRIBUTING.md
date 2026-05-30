# Contributing to Speqify

Thanks for your interest! Speqify is a pnpm + Turborepo monorepo: an MV3 browser
extension (`apps/extension`, WXT + React), a landing site (`apps/landing`, Vite),
and shared packages (`packages/core`, `packages/ui`).

## Develop in a container (recommended)

Installs and builds run **inside a container** so your host stays clean (deps live
in a volume). Use Docker or rootless Podman.

```bash
# devcontainer CLI
devcontainer up --workspace-folder . --docker-path podman
devcontainer exec --workspace-folder . bash

# …or podman compose
podman compose run --rm install      # deps (frozen lockfile)
podman compose run --rm shell        # a shell with the toolchain
```

Inside the container (note: `corepack enable pnpm` first if `pnpm` isn't on PATH):

```bash
pnpm -r typecheck        # type-check every package
pnpm -r lint             # ESLint (flat config)
pnpm --filter @speqify/core test   # Vitest
pnpm ext:build           # build the extension → apps/extension/.output/chrome-mv3
pnpm --filter @speqify/landing build
```

**The browser runs on your HOST, not in the container.** Load the built extension via
`chrome://extensions` → enable Developer mode → **Load unpacked** →
`apps/extension/.output/chrome-mv3`.

## Before opening a PR

- `pnpm -r typecheck && pnpm -r lint && pnpm --filter @speqify/core test` all pass.
- `pnpm format` (Prettier — width 100, double quotes) is clean.
- Keep changes focused; match the surrounding code style.
- If your change touches capture/AI/trackers, smoke-test the relevant flow in the
  browser (the on-device model + WebGPU bits can't be covered by CI).

## Security

Please report vulnerabilities privately — see [`SECURITY.md`](./SECURITY.md). Don't
open a public issue for security problems.

## License

By contributing, you agree your contributions are licensed under the project's
[MIT License](./LICENSE).
