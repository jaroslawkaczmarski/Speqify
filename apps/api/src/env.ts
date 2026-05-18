/**
 * Worker bindings + resolved runtime config.
 *
 * Secrets come from Cloudflare Secrets Store in production (§9). Locally they
 * are provided via `.dev.vars`. Never commit real values.
 */
export interface Env {
  readonly ENVIRONMENT?: string;
  /** SuperAdmin login email (single shared admin, §11). */
  readonly SUPERADMIN_EMAIL?: string;
  /** PBKDF2 string `pbkdf2$<iter>$<salt>$<hash>` for the SuperAdmin password. */
  readonly SUPERADMIN_PASSWORD_HASH?: string;
  /** HMAC secret used to sign session tokens. */
  readonly SESSION_SECRET?: string;
  /** D1 binding — present once the database is provisioned (Phase 0/1 cloud). */
  readonly DB?: D1Database;
}

export interface AppConfig {
  superAdminEmail: string;
  superAdminPasswordHash: string;
  sessionSecret: string;
}

export function resolveConfig(env: Env): AppConfig {
  const superAdminEmail = env.SUPERADMIN_EMAIL;
  const superAdminPasswordHash = env.SUPERADMIN_PASSWORD_HASH;
  const sessionSecret = env.SESSION_SECRET;
  if (!superAdminEmail || !superAdminPasswordHash || !sessionSecret) {
    throw new Error(
      "Missing required config: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD_HASH, SESSION_SECRET",
    );
  }
  return { superAdminEmail, superAdminPasswordHash, sessionSecret };
}
