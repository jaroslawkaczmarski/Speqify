CREATE TABLE `analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`annotation_ids` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`finished_at` text,
	`error` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`panel_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`client_annotation_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`audience` text NOT NULL,
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
	`structured` text,
	`technical` text,
	`host_app` text,
	`client_created_at` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`correlation_id` text NOT NULL,
	FOREIGN KEY (`panel_id`) REFERENCES `panels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `annotations_panel_status_idx` ON `annotations` (`panel_id`,`status`);--> statement-breakpoint
CREATE INDEX `annotations_submission_idx` ON `annotations` (`submission_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `annotations_panel_client_uq` ON `annotations` (`panel_id`,`client_annotation_id`);--> statement-breakpoint
CREATE TABLE `export_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`target` text NOT NULL,
	`encrypted_credentials_ref` text,
	`field_mapping` text NOT NULL,
	`defaults` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `panels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`audience` text NOT NULL,
	`secret_token` text NOT NULL,
	`environment_url` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `panels_secret_token_unique` ON `panels` (`secret_token`);--> statement-breakpoint
CREATE INDEX `panels_project_idx` ON `panels` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product_owner_id` text NOT NULL,
	`environment_urls` text NOT NULL,
	`template` text NOT NULL,
	`export_config_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`panel_id` text NOT NULL,
	`client_id` text NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`panel_id`) REFERENCES `panels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submissions_panel_idx` ON `submissions` (`panel_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`parent_task_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`acceptance_criteria` text NOT NULL,
	`labels` text NOT NULL,
	`component` text,
	`version` text,
	`priority` text,
	`annotation_ids` text NOT NULL,
	`screenshot_keys` text NOT NULL,
	`external_id` text,
	`export_error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_project_status_idx` ON `tasks` (`project_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);