import type { Reviewer, ReviewSession } from "@speqify/shared";
import type { Env } from "./env.js";
import type { SessionClaims } from "./lib/crypto.js";

export interface AppVars {
  correlationId: string;
  /** Set by the SDK-auth middleware once the session+reviewer token pair
   *  has been validated against the repository. */
  reviewSession: ReviewSession;
  reviewer: Reviewer;
  /** JWT session claims for SA/PO console requests. */
  session: SessionClaims;
  body: unknown;
}

export type AppEnv = { Bindings: Env; Variables: AppVars };
