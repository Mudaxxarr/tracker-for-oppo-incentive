-- rebate_jobs was created (Task 1, central-price-auto-adjust) without RLS enabled,
-- inconsistent with every other table (see 0008_enable_rls.sql). Same caveat applies:
-- this blocks the Supabase public REST API (anon/authenticated) only — the
-- Next.js app's own Postgres connection bypasses RLS by role, so this is not a
-- defense against bugs in the app's own tenantId-scoping code.
ALTER TABLE "rebate_jobs" ENABLE ROW LEVEL SECURITY;
