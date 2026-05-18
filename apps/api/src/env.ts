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
  /** AES-GCM master key (b64url, 32 bytes) for envelope-encrypting export creds. */
  readonly ENVELOPE_MASTER_KEY?: string;
  /** D1 binding — present once the database is provisioned (Phase 0/1 cloud). */
  readonly DB?: D1Database;
  /** R2 binding for media (screenshots/voice/recordings). */
  readonly MEDIA?: R2Bucket;
}

export interface AppConfig {
  superAdminEmail: string;
  superAdminPasswordHash: string;
  sessionSecret: string;
  envelopeKey: string;
}

export function resolveConfig(env: Env): AppConfig {
  const superAdminEmail = env.SUPERADMIN_EMAIL;
  const superAdminPasswordHash = env.SUPERADMIN_PASSWORD_HASH;
  const sessionSecret = env.SESSION_SECRET;
  const envelopeKey = env.ENVELOPE_MASTER_KEY;
  if (!superAdminEmail || !superAdminPasswordHash || !sessionSecret || !envelopeKey) {
    throw new Error(
      "Missing required config: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD_HASH, SESSION_SECRET, ENVELOPE_MASTER_KEY",
    );
  }
  return { superAdminEmail, superAdminPasswordHash, sessionSecret, envelopeKey };
}
