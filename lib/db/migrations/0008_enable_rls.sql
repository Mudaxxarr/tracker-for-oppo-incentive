-- Enable Row-Level Security on all tables.
-- With RLS enabled and no policies, the Supabase public REST API (anon/authenticated roles)
-- is blocked by default. The service_role used by the Next.js app bypasses RLS automatically.
ALTER TABLE "dealer_tenants"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dealer_users"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dealer_ids"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "models"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_price_history"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchases"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activations"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "target_bonus_policies"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_in_policies"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activation_incentive_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dealer_incentive_policies"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cross_region_transfers"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inter_id_transfers"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cr_caught"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warranty_claims"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scripts"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "owner_alerts"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_settings"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rebates"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "owner_staff"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dealer_daily_backups"         ENABLE ROW LEVEL SECURITY;
