CREATE TABLE "rebates" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"old_dealer_price" real NOT NULL,
	"new_dealer_price" real NOT NULL,
	"rebate_per_unit" real NOT NULL,
	"eligible_qty" integer NOT NULL,
	"total_rebate_amount" real NOT NULL,
	"rebate_date" text NOT NULL,
	"price_history_id" text,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_staff" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'so' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rebates_by_dealer" ON "rebates" ("tenant_id","dealer_id","rebate_date");
--> statement-breakpoint
CREATE INDEX "rebates_by_model" ON "rebates" ("tenant_id","model_id","rebate_date");
