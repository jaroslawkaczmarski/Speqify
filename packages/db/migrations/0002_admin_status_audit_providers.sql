-- Tranche B (SA dashboard real data): project lifecycle status, append-only
-- audit log, singleton platform provider config.
ALTER TABLE `projects` ADD COLUMN `status` text DEFAULT 'live' NOT NULL;--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`summary` text NOT NULL,
	`severity` text DEFAULT 'ok' NOT NULL,
	`project_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `platform_config` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_provider` text NOT NULL,
	`ai_model` text NOT NULL,
	`ai_endpoint` text,
	`ai_key_ref` text,
	`ai_key_hint` text,
	`transcription_provider` text NOT NULL,
	`transcription_endpoint` text
);
