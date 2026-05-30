-- Ledger security: index for rebate re-evaluation deletes + financial integrity constraints
CREATE INDEX IF NOT EXISTS "rebates_by_price_history" ON "rebates" ("tenant_id","price_history_id","dealer_id");
--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_rebate_per_unit_pos" CHECK ("rebate_per_unit" > 0);
--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_eligible_qty_pos" CHECK ("eligible_qty" >= 0);
--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_total_amount_pos" CHECK ("total_rebate_amount" >= 0);
