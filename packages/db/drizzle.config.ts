import type { Config } from "drizzle-kit";

/**
 * D1 (SQLite) — Phase 1. Migrations are generated locally and applied via
 * `wrangler d1 migrations apply` (see IMPLEMENTATION_PLAN.md §6 Phase 1).
 */
export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
} satisfies Config;
