-- Explicit deny-all policies for anon/authenticated on every table.
--
-- RLS-enabled-with-no-policy already defaults to deny for these roles (see
-- 0008_enable_rls.sql) — this migration does not change actual behavior today.
-- It formalizes that default into an explicit, self-documenting policy so a
-- future permissive policy accidentally added for one role/command can't
-- silently open a table to Supabase's public REST API. The Next.js app's own
-- Postgres connection uses the `postgres` role, which has BYPASSRLS and is
-- unaffected by any policy here (verified: rolbypassrls = true).
CREATE POLICY "deny_public_api" ON "activation_incentive_policies" FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "activations"                   FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "app_settings"                  FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "audit_log"                     FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "billing_events"                FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "cr_caught"                     FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "cross_region_transfers"        FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "customers"                     FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "dealer_daily_backups"          FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "dealer_ids"                    FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "dealer_incentive_policies"     FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "dealer_tenants"                FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "dealer_users"                  FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "inter_id_transfers"            FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "model_price_history"           FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "models"                        FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "owner_alerts"                  FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "owner_staff"                   FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "purchases"                    FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "rebate_jobs"                   FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "rebates"                       FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "scripts"                       FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "stock_in_policies"             FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "target_bonus_policies"         FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "warranty_claims"               FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_public_api" ON "__drizzle_migrations"          FOR ALL TO anon, authenticated USING (false);
