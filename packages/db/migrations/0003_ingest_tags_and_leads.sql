-- Tranche D: annotation reviewer tags ("Etykiety") + closed-beta landing leads.
ALTER TABLE `annotations` ADD COLUMN `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
