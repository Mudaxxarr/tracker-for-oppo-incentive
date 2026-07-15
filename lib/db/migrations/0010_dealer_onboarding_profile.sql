ALTER TABLE "dealer_tenants"
ADD COLUMN IF NOT EXISTS "onboarding_profile" text NOT NULL DEFAULT '{}';
