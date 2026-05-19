-- Phase 8 (PO review): AI confidence, sub-task type, review timestamp,
-- optimistic-lock revision. SQLite ADD COLUMN is non-rewriting; `rev` carries a
-- NOT NULL default so existing rows backfill to revision 1.
ALTER TABLE `tasks` ADD COLUMN `confidence` real;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `subtask_type` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `rev` integer DEFAULT 1 NOT NULL;
