# Deployment

Production runs entirely on Cloudflare (account `jarek.pl@gmail.com`,
`cbeac96e457aa67e4e90dd570be30017`). Three deployables, all auto-deployed
by `.github/workflows/deploy.yml` on every push to `main`:

| App     | Source         | Target                    | URL                         |
| ------- | -------------- | ------------------------- | --------------------------- |
| API     | `apps/api`     | Worker `speqify-api`      | `https://api.speqify.app`   |
| Landing | `apps/landing` | Pages `speqify-landing`   | `https://speqify.app`       |
| Panel   | `apps/panel`   | Pages `speqify-panel`     | `https://admin.speqify.app` |

## Live state

- **API**: deployed; custom domain `api.speqify.app` (TLS, sticky — a
  one-time account resource, intentionally **not** in `wrangler.toml`
  routes so CI needs no zone scope). Bindings: D1 `speqify`, R2
  `speqify-media`, Queue `speqify-transcription` (producer+consumer),
  Workers AI. Secrets set via `wrangler secret put`: `SUPERADMIN_EMAIL`,
  `SUPERADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `ENVELOPE_MASTER_KEY`.
  Non-secret config (`ENVIRONMENT`, `PANEL_ORIGINS`) in `[vars]`.
- **D1**: remote `speqify` migrated to `0003` (full schema).
- **DNS**: `speqify.app` + `admin.speqify.app` proxied CNAMEs →
  `speqify-{landing,panel}.pages.dev`; Pages custom domains `active`
  with Google-issued certs. `api.speqify.app` resolves via the Workers
  custom-domain path.
- **CI**: `deploy.yml` (jobs `api` + `web`) deploys all three on push to
  `main`; secret `CLOUDFLARE_API_TOKEN` is set in the repo.

## CI deploy model

The two Pages projects were created as **Direct Upload**, which
Cloudflare does not allow connecting to Git in the dashboard. So instead
of native Pages-Git builds, the `web` CI job builds the SPAs
(`VITE_API_BASE=https://api.speqify.app`) and ships them with
`wrangler pages deploy`. This is intentional and needs no dashboard step.

`CLOUDFLARE_API_TOKEN` scopes required by `deploy.yml`:

- Account → **Workers Scripts: Edit**
- Account → **Cloudflare Pages: Edit**
- Account → **Account Settings: Read**
- Account → **D1: Edit**
- User → **User Details: Read**

No Zone scopes are needed (DNS + the API custom domain are one-time setup,
already done).

## Operations

- **Manual API deploy**: `cd apps/api && npx wrangler deploy`
- **Manual Pages deploy**: `VITE_API_BASE=https://api.speqify.app pnpm
  --filter @speqify/<app> build` then `npx wrangler pages deploy
  apps/<app>/dist --project-name=speqify-<app> --branch=main`
- **Re-create the `api.speqify.app` custom domain** (only if ever
  deleted): dashboard → `speqify-api` → Triggers → Custom Domains, or add
  `routes = [{ pattern = "api.speqify.app", custom_domain = true }]` back
  to `wrangler.toml` and deploy with a token that also has
  Zone:Workers-Routes:Edit + Zone:DNS:Edit on `speqify.app`.
- **D1 migrations**: forward `.sql` in `packages/db/migrations`; apply
  with `npx wrangler d1 execute speqify --remote --file <f>`.
- **Rotate SuperAdmin password**: regenerate a `pbkdf2$…` hash with the
  algorithm in `apps/api/src/lib/crypto.ts` (PBKDF2-SHA256, 100k iters,
  16-byte salt, b64url) and `npx wrangler secret put
  SUPERADMIN_PASSWORD_HASH`.
- **Rotate the CI token**: create a new API token with the scopes above,
  then `gh secret set CLOUDFLARE_API_TOKEN -R jaroslawkaczmarski/speqify`.
