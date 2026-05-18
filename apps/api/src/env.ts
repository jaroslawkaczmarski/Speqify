/**
 * Worker bindings + resolved runtime config.
 *
 * Secrets come from Cloudflare Secrets Store in production (§9). Locally they
 * are provided via `.dev.vars`. Never commit real values.
 */
import type { AiBinding } from "./transcribe/types.js";

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
  /** Workers AI binding (default Whisper transcription). */
  readonly AI?: AiBinding;
  /** External transcription provider (OpenAI/Groq-compatible) — optional. */
  readonly TRANSCRIBE_ENDPOINT?: string;
  readonly TRANSCRIBE_API_KEY?: string;
  readonly TRANSCRIBE_MODEL?: string;
  /** LLM for task generation (AI Gateway / OpenAI-compatible) — optional. */
  readonly LLM_ENDPOINT?: string;
  readonly LLM_API_KEY?: string;
  readonly LLM_MODEL?: string;
  /** Comma-separated allowed origins for the SA/PO SPA (CORS). */
  readonly PANEL_ORIGINS?: string;
}

export interface AppConfig {
  superAdminEmail: string;
  superAdminPasswordHash: string;
  sessionSecret: string;
  envelopeKey: string;
  panelOrigins: string[];
}

const DEFAULT_PANEL_ORIGINS = [
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

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
  const panelOrigins = env.PANEL_ORIGINS
    ? env.PANEL_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_PANEL_ORIGINS;
  return { superAdminEmail, superAdminPasswordHash, sessionSecret, envelopeKey, panelOrigins };
}
