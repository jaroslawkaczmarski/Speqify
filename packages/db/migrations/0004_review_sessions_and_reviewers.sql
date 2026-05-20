-- RS-2: Replace panel-based identity with ReviewSession + Reviewer (§11).
-- prod has 0 annotations/submissions and 1 unused panel row at the time of
-- this migration; the panel-based tables are dropped + rebuilt cleanly.

DROP TABLE IF EXISTS `annotations`;
--> statement-breakpoint
DROP TABLE IF EXISTS `submissions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `panels`;
--> statement-breakpoint

CREATE TABLE `review_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`env_url` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_sessions_token_unique` ON `review_sessions` (`token`);
--> statement-breakpoint
CREATE INDEX `review_sessions_project_idx` ON `review_sessions` (`project_id`);
--> statement-breakpoint

CREATE TABLE `reviewers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`accepted_at` text,
	`last_seen_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `review_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewers_token_unique` ON `reviewers` (`token`);
--> statement-breakpoint
CREATE INDEX `reviewers_session_idx` ON `reviewers` (`session_id`);
--> statement-breakpoint

CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`client_id` text NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `review_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submissions_session_idx` ON `submissions` (`session_id`);
--> statement-breakpoint
CREATE INDEX `submissions_reviewer_idx` ON `submissions` (`reviewer_id`);
--> statement-breakpoint

CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`client_annotation_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`page_url` text NOT NULL,
	`breadcrumb` text,
	`element` text,
	`screenshot` text,
	`voice` text,
	`recording_video` text,
	`recording_audio` text,
	`transcript` text,
	`transcription_status` text,
	`text_note` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`structured` text,
	`technical` text,
	`host_app` text,
	`client_created_at` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`correlation_id` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `review_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `annotations_session_status_idx` ON `annotations` (`session_id`, `status`);
--> statement-breakpoint
CREATE INDEX `annotations_submission_idx` ON `annotations` (`submission_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `annotations_session_reviewer_client_uq` ON `annotations` (`session_id`, `reviewer_id`, `client_annotation_id`);

-- projects.template (single ProjectTemplate) becomes projects.templates
-- (Record<TaskType, ProjectTemplate>). SQLite supports RENAME COLUMN since
-- 3.25, but the content shape also changes — for prod (1 project) the PO
-- will save fresh templates through the new UI; here we just rename the
-- column and seed an empty JSON object so the schema matches.
--> statement-breakpoint
ALTER TABLE `projects` RENAME COLUMN `template` TO `templates`;
--> statement-breakpoint
UPDATE `projects` SET `templates` = '{}' WHERE `templates` IS NULL OR `templates` = '';
