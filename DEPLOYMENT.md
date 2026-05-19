# Deployment

Production runs entirely on Cloudflare (account `jarek.pl@gmail.com`,
`cbeac96e457aa67e4e90dd570be30017`). Three deployables:

| App     | Source        | Target              | Production URL          |
| ------- | ------------- | ------------------- | ----------------------- |
| API     | `apps/api`    | Workers (`speqify-api`) | `https://api.speqify.app`   |
| Landing | `apps/landing`| Pages (`speqify-landing`) | `https://speqify.app`       |
| Panel   | `apps/panel`  | Pages (`speqify-panel`)   | `https://admin.speqify.app` |

## Current state (already done)

- **API**: deployed (`wrangler deploy`), custom domain `api.speqify.app`
  live with TLS, all bindings wired (D1 `speqify`, R2 `speqify-media`,
  Queue `speqify-transcription` producer+consumer, Workers AI). Secrets
  set via `wrangler secret put`: `SUPERADMIN_EMAIL`,
  `SUPERADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `ENVELOPE_MASTER_KEY`.
  Non-secret config (`ENVIRONMENT`, `PANEL_ORIGINS`) in `wrangler.toml [vars]`.
- **D1**: remote `speqify` migrated to `0003` (full schema).
- **Pages**: both projects created and deployed (initial direct upload).
  Build settings + `VITE_API_BASE=https://api.speqify.app` + `NODE_VERSION=22`
  pre-configured for Git builds. Temp URLs live now:
  `https://speqify-landing.pages.dev`, `https://speqify-panel.pages.dev`.
- **Custom domains**: `speqify.app` and `admin.speqify.app` registered on
  the Pages projects (status: pending — waiting on DNS, see step A).

## Remaining manual steps (only these — they need permissions the deploy token lacks)

### A. Add 2 DNS records  *(blocks the custom domains)*

The wrangler OAuth token is **zone-read-only**, so it cannot create DNS
records. In the Cloudflare dashboard → `speqify.app` zone → DNS → add:

| Type  | Name    | Target                      | Proxy |
| ----- | ------- | --------------------------- | ----- |
| CNAME | `@`     | `speqify-landing.pages.dev` | Proxied (orange) |
| CNAME | `admin` | `speqify-panel.pages.dev`   | Proxied (orange) |

Cloudflare flattens the apex CNAME automatically. Within minutes the
Pages custom-domain status flips `pending → active` and TLS provisions.
(`api.speqify.app` already resolves — Workers custom domains create their
own DNS via a different path.)

### B. Connect the GitHub repo to both Pages projects  *(enables push-to-deploy)*

Dashboard → Workers & Pages → `speqify-landing` → Settings → Builds &
deployments → **Connect to Git** → authorize the GitHub App → pick
`jaroslawkaczmarski/speqify`, production branch `main`. Repeat for
`speqify-panel`. Build command / output dir / env vars are already set
via API, so no further config is needed. After connecting, every push to
`main` rebuilds and deploys both static apps automatically.

### C. API auto-deploy secret  *(enables the Deploy API workflow)*

`.github/workflows/deploy-api.yml` deploys the Worker on push to `main`.
It needs a repo secret `CLOUDFLARE_API_TOKEN`:

1. Dashboard → My Profile → API Tokens → Create Token. Scopes:
   - Account → Workers Scripts: Edit
   - Account → Account Settings: Read
   - Account → D1: Edit
   - Zone → `speqify.app` → DNS: Edit  *(also fixes step A if you'd
     rather re-run `wrangler deploy` than add DNS by hand)*
   - Zone → `speqify.app` → Workers Routes: Edit
2. `gh secret set CLOUDFLARE_API_TOKEN -R jaroslawkaczmarski/speqify`
   (paste the token), or add it in GitHub → Settings → Secrets.

## Operations

- **Manual API deploy**: `cd apps/api && npx wrangler deploy`
- **Manual Pages deploy**: `pnpm --filter @speqify/<app> build` then
  `npx wrangler pages deploy apps/<app>/dist --project-name=speqify-<app>`
- **D1 migrations**: forward `.sql` files in `packages/db/migrations`;
  apply with `npx wrangler d1 execute speqify --remote --file <f>`
- **Rotate SuperAdmin password**: generate a new `pbkdf2$…` hash with the
  algorithm in `apps/api/src/lib/crypto.ts` (PBKDF2-SHA256, 100k iters,
  16-byte salt, b64url) and `npx wrangler secret put SUPERADMIN_PASSWORD_HASH`.
