CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`dealer_id` text,
	`entity_type` text,
	`entity_id` text,
	`status` text DEFAULT 'ok' NOT NULL,
	`payload` text,
	`summary` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_by_dealer` ON `audit_log` (`dealer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_by_action` ON `audit_log` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_by_created` ON `audit_log` (`created_at`);