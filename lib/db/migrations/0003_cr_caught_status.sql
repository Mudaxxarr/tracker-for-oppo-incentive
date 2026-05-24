ALTER TABLE "cr_caught" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
