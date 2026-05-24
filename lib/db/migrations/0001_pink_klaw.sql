CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"cnic" text,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_daily_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"backup_date" text NOT NULL,
	"data" text NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"dealer_id" text,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"customer_id" text,
	"activation_id" text,
	"model_id" text NOT NULL,
	"issue_desc" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
ALTER TABLE "activations" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "dealer_tenants" ADD COLUMN "features" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_tenants" ADD COLUMN "backdate_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_tenants" ADD COLUMN "purchase_approval_threshold" integer;--> statement-breakpoint
ALTER TABLE "dealer_tenants" ADD COLUMN "monthly_fee" real;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "low_stock_threshold" integer;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "review_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_daily_backups" ADD CONSTRAINT "dealer_daily_backups_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_alerts" ADD CONSTRAINT "owner_alerts_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_activation_id_activations_id_fk" FOREIGN KEY ("activation_id") REFERENCES "public"."activations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_by_dealer" ON "customers" USING btree ("tenant_id","dealer_id","created_at");--> statement-breakpoint
CREATE INDEX "customers_by_phone" ON "customers" USING btree ("tenant_id","dealer_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_daily_backups_tenant_date" ON "dealer_daily_backups" USING btree ("tenant_id","backup_date");--> statement-breakpoint
CREATE INDEX "owner_alerts_by_tenant" ON "owner_alerts" USING btree ("tenant_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "warranty_by_dealer" ON "warranty_claims" USING btree ("tenant_id","dealer_id","created_at");--> statement-breakpoint
CREATE INDEX "warranty_by_status" ON "warranty_claims" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;