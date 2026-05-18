import type { Panel } from "@speqify/shared";
import type { Env } from "./env.js";
import type { SessionClaims } from "./lib/crypto.js";

export interface AppVars {
  correlationId: string;
  panel: Panel;
  session: SessionClaims;
  body: unknown;
}

export type AppEnv = { Bindings: Env; Variables: AppVars };
