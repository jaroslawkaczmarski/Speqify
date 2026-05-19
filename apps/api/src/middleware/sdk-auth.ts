import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { ApiException } from "../lib/http.js";
import type { Repository } from "../repo/types.js";
import type { AppEnv } from "../types.js";

interface TokenSourceOpts {
  /** Path param to read the session token from (intro endpoint uses `:sessionToken`). */
  sessionTokenParam?: string;
  /** Query param to read the reviewer token from (intro endpoint uses `reviewer`). */
  reviewerTokenQuery?: string;
  /** When false, skip the live-status/window checks. Default true. */
  requireLive?: boolean;
}

function extractTokens(c: Context<AppEnv>, opts: TokenSourceOpts) {
  const sessionToken =
    (opts.sessionTokenParam ? c.req.param(opts.sessionTokenParam) : undefined) ??
    c.req.header("x-speqify-session") ??
    c.req.query("speqify_session") ??
    "";
  const reviewerToken =
    (opts.reviewerTokenQuery ? c.req.query(opts.reviewerTokenQuery) : undefined) ??
    c.req.header("x-speqify-reviewer") ??
    c.req.query("speqify_reviewer") ??
    "";
  return { sessionToken, reviewerToken };
}

/**
 * Token-pair guard for SDK-facing endpoints. Resolves the session token (path
 * param or `X-Speqify-Session` header) and reviewer token (query param or
 * `X-Speqify-Reviewer` header) against the repository, then exposes both on
 * the Hono context as `reviewSession` + `reviewer`. Revoked reviewers and
 * non-live sessions are rejected here so handlers see only valid access
 * (§9, §14).
 */
export function withSdkSession(repo: Repository, opts: TokenSourceOpts = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { sessionToken, reviewerToken } = extractTokens(c, opts);
    if (!sessionToken || !reviewerToken) {
      throw new ApiException("unauthorized", "Missing session or reviewer token");
    }
    const session = await repo.getReviewSessionByToken(sessionToken);
    if (!session) throw new ApiException("not_found", "Review session not found");
    const reviewer = await repo.getReviewerByToken(reviewerToken);
    if (!reviewer || reviewer.sessionId !== session.id) {
      throw new ApiException("not_found", "Reviewer not found for this session");
    }
    if (reviewer.status === "declined") {
      throw new ApiException("forbidden", "Reviewer access has been revoked");
    }
    if (opts.requireLive !== false) {
      if (session.status !== "live") {
        throw new ApiException("session_unavailable", "Review session is not active");
      }
      const now = Date.now();
      if (session.startsAt && Date.parse(session.startsAt) > now) {
        throw new ApiException("session_unavailable", "Review session has not started");
      }
      if (session.endsAt && Date.parse(session.endsAt) < now) {
        throw new ApiException("session_unavailable", "Review session has ended");
      }
    }
    c.set("reviewSession", session);
    c.set("reviewer", reviewer);
    await next();
  });
}
