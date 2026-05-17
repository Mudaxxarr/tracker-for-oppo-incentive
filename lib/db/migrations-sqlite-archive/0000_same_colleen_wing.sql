CREATE TABLE `activation_incentive_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`per_unit_amount` real NOT NULL,
	`target_qty` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `aip_by_dealer` ON `activation_incentive_policies` (`dealer_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `aip_by_model` ON `activation_incentive_policies` (`model_id`,`period_start`);--> statement-breakpoint
CREATE TABLE `activations` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`purchase_id` text,
	`imei` text,
	`activation_date` text NOT NULL,
	`dealer_price_snapshot` real NOT NULL,
	`is_cross_region` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activations_by_dealer` ON `activations` (`dealer_id`,`activation_date`);--> statement-breakpoint
CREATE INDEX `activations_by_model` ON `activations` (`model_id`,`activation_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `activations_imei_unique` ON `activations` (`imei`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cross_region_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`reported_date` text NOT NULL,
	`shifted_to_id_date` text,
	`source_region_note` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `crt_by_dealer` ON `cross_region_transfers` (`dealer_id`,`reported_date`);--> statement-breakpoint
CREATE TABLE `dealer_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dealer_incentive_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`target_total_activations` integer NOT NULL,
	`per_unit_amount` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dip_by_dealer` ON `dealer_incentive_policies` (`dealer_id`,`period_start`);--> statement-breakpoint
CREATE TABLE `inter_id_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`from_dealer_id` text NOT NULL,
	`to_dealer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`transfer_date` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`from_dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `iit_by_from` ON `inter_id_transfers` (`from_dealer_id`,`transfer_date`);--> statement-breakpoint
CREATE INDEX `iit_by_to` ON `inter_id_transfers` (`to_dealer_id`,`transfer_date`);--> statement-breakpoint
CREATE TABLE `model_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`dealer_price` real NOT NULL,
	`invoice_price` real NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mph_by_model` ON `model_price_history` (`model_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_name_unique` ON `models` (`name`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_dealer_price` real NOT NULL,
	`unit_invoice_price` real NOT NULL,
	`purchase_date` text NOT NULL,
	`source` text NOT NULL,
	`reference_note` text,
	`cross_region_transfer_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `purchases_by_dealer` ON `purchases` (`dealer_id`,`purchase_date`);--> statement-breakpoint
CREATE INDEX `purchases_by_model` ON `purchases` (`model_id`,`purchase_date`);--> statement-breakpoint
CREATE TABLE `stock_in_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`per_unit_amount` real NOT NULL,
	`min_qty` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sip_by_dealer` ON `stock_in_policies` (`dealer_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `sip_by_model` ON `stock_in_policies` (`model_id`,`period_start`);--> statement-breakpoint
CREATE TABLE `target_bonus_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`target_activations_qty` integer NOT NULL,
	`bonus_percent` real DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealer_ids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tbp_by_dealer` ON `target_bonus_policies` (`dealer_id`,`period_start`);