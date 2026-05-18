import { createMiddleware } from "hono/factory";
import type { AppConfig } from "../env.js";
import { issueSession, verifyPassword, verifySession } from "../lib/crypto.js";
import { ApiException } from "../lib/http.js";
import type { Repository } from "../repo/types.js";
import type { AppEnv } from "../types.js";

const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface AuthResult {
  token: string;
  role: string;
  sub: string;
}

/**
 * SuperAdmin authenticates against the platform secret (single shared admin,
 * §11). Product Owners authenticate against their hashed account password.
 */
export async function authenticate(
  repo: Repository,
  config: AppConfig,
  email: string,
  password: string,
): Promise<AuthResult | null> {
  let role: string | null = null;
  let sub: string | null = null;

  if (email.toLowerCase() === config.superAdminEmail.toLowerCase()) {
    if (await verifyPassword(password, config.superAdminPasswordHash)) {
      role = "superadmin";
      sub = "superadmin";
    }
  } else {
    const user = await repo.getUserByEmail(email);
    if (user?.passwordHash && (await verifyPassword(password, user.passwordHash))) {
      role = user.role;
      sub = user.id;
    }
  }

  if (!role || !sub) return null;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await issueSession(config.sessionSecret, { sub, role, exp });
  return { token, role, sub };
}

/** Bearer-session guard restricted to the given roles. */
export function requireRole(config: AppConfig, roles: readonly string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const claims = token ? await verifySession(config.sessionSecret, token) : null;
    if (!claims || !roles.includes(claims.role)) {
      throw new ApiException("unauthorized", "Authentication required");
    }
    c.set("session", claims);
    await next();
  });
}
