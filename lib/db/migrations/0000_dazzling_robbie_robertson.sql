CREATE TABLE "activation_incentive_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"per_unit_amount" real NOT NULL,
	"target_qty" integer,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"purchase_id" text,
	"imei" text,
	"activation_date" text NOT NULL,
	"dealer_price_snapshot" real NOT NULL,
	"is_cross_region" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"dealer_id" text,
	"entity_type" text,
	"entity_id" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"payload" text,
	"summary" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cr_caught" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"caught_date" text NOT NULL,
	"dealer_price_snapshot" real NOT NULL,
	"note" text,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_region_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"reported_date" text NOT NULL,
	"shifted_to_id_date" text,
	"source_region_note" text,
	"status" text NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_ids" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_incentive_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"target_total_activations" integer NOT NULL,
	"per_unit_amount" real NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"owner_email" text NOT NULL,
	"plan_months" integer NOT NULL,
	"started_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL,
	CONSTRAINT "dealer_tenants_owner_email_unique" UNIQUE("owner_email")
);
--> statement-breakpoint
CREATE TABLE "dealer_users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL,
	CONSTRAINT "dealer_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "inter_id_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"from_dealer_id" text NOT NULL,
	"to_dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"transfer_date" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'ACCEPTED' NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"model_id" text NOT NULL,
	"dealer_price" real NOT NULL,
	"invoice_price" real NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_dealer_price" real NOT NULL,
	"unit_invoice_price" real NOT NULL,
	"purchase_date" text NOT NULL,
	"source" text NOT NULL,
	"reference_note" text,
	"cross_region_transfer_id" text,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_in_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"model_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"per_unit_amount" real NOT NULL,
	"min_qty" integer,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_bonus_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"target_activations_qty" integer NOT NULL,
	"bonus_percent" real DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT (now()::text) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activation_incentive_policies" ADD CONSTRAINT "activation_incentive_policies_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_incentive_policies" ADD CONSTRAINT "activation_incentive_policies_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_incentive_policies" ADD CONSTRAINT "activation_incentive_policies_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cr_caught" ADD CONSTRAINT "cr_caught_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cr_caught" ADD CONSTRAINT "cr_caught_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cr_caught" ADD CONSTRAINT "cr_caught_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_region_transfers" ADD CONSTRAINT "cross_region_transfers_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_region_transfers" ADD CONSTRAINT "cross_region_transfers_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_region_transfers" ADD CONSTRAINT "cross_region_transfers_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_ids" ADD CONSTRAINT "dealer_ids_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_incentive_policies" ADD CONSTRAINT "dealer_incentive_policies_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_incentive_policies" ADD CONSTRAINT "dealer_incentive_policies_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_incentive_policies" ADD CONSTRAINT "dealer_incentive_policies_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_users" ADD CONSTRAINT "dealer_users_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_id_transfers" ADD CONSTRAINT "inter_id_transfers_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_id_transfers" ADD CONSTRAINT "inter_id_transfers_from_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("from_dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_id_transfers" ADD CONSTRAINT "inter_id_transfers_to_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("to_dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_id_transfers" ADD CONSTRAINT "inter_id_transfers_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_price_history" ADD CONSTRAINT "model_price_history_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_price_history" ADD CONSTRAINT "model_price_history_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_policies" ADD CONSTRAINT "stock_in_policies_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_policies" ADD CONSTRAINT "stock_in_policies_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_policies" ADD CONSTRAINT "stock_in_policies_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_bonus_policies" ADD CONSTRAINT "target_bonus_policies_tenant_id_dealer_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dealer_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_bonus_policies" ADD CONSTRAINT "target_bonus_policies_dealer_id_dealer_ids_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer_ids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aip_by_dealer" ON "activation_incentive_policies" USING btree ("tenant_id","dealer_id","period_start");--> statement-breakpoint
CREATE INDEX "aip_by_model" ON "activation_incentive_policies" USING btree ("tenant_id","model_id","period_start");--> statement-breakpoint
CREATE INDEX "activations_by_dealer" ON "activations" USING btree ("tenant_id","dealer_id","activation_date");--> statement-breakpoint
CREATE INDEX "activations_by_model" ON "activations" USING btree ("tenant_id","model_id","activation_date");--> statement-breakpoint
CREATE UNIQUE INDEX "activations_imei_unique" ON "activations" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "audit_by_dealer" ON "audit_log" USING btree ("dealer_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_by_action" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_by_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "crc_by_dealer" ON "cr_caught" USING btree ("tenant_id","dealer_id","caught_date");--> statement-breakpoint
CREATE INDEX "crt_by_dealer" ON "cross_region_transfers" USING btree ("tenant_id","dealer_id","reported_date");--> statement-breakpoint
CREATE INDEX "dip_by_dealer" ON "dealer_incentive_policies" USING btree ("tenant_id","dealer_id","period_start");--> statement-breakpoint
CREATE INDEX "iit_by_from" ON "inter_id_transfers" USING btree ("tenant_id","from_dealer_id","transfer_date");--> statement-breakpoint
CREATE INDEX "iit_by_to" ON "inter_id_transfers" USING btree ("tenant_id","to_dealer_id","transfer_date");--> statement-breakpoint
CREATE INDEX "mph_by_model" ON "model_price_history" USING btree ("tenant_id","model_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "models_name_unique" ON "models" USING btree ("name");--> statement-breakpoint
CREATE INDEX "purchases_by_dealer" ON "purchases" USING btree ("tenant_id","dealer_id","purchase_date");--> statement-breakpoint
CREATE INDEX "purchases_by_model" ON "purchases" USING btree ("tenant_id","model_id","purchase_date");--> statement-breakpoint
CREATE INDEX "sip_by_dealer" ON "stock_in_policies" USING btree ("tenant_id","dealer_id","period_start");--> statement-breakpoint
CREATE INDEX "sip_by_model" ON "stock_in_policies" USING btree ("tenant_id","model_id","period_start");--> statement-breakpoint
CREATE INDEX "tbp_by_dealer" ON "target_bonus_policies" USING btree ("tenant_id","dealer_id","period_start");