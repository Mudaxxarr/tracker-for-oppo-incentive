# Staged Rollout Blueprint

How to ship any dealer-portal update safely: test it on yourself first, then release to all dealers, with one-click rollback.

## The principle

Code deploys for everyone; a **feature flag** decides who sees it. Flags live per-tenant in `dealer_tenants.features` (JSON). A feature wrapped in a flag is invisible until the flag is `true` for that tenant.

## The four stages

### Stage 0 — Build behind a flag
1. Add a key to `lib/dealer-features.ts` (core feature) or `lib/dealer-addons.ts` (paid add-on).
2. Gate the page: `if (!isFeatureEnabled(features, "my_key")) return <FeatureDisabled />;`
   (see `app/dealer/(portal)/reports/page.tsx` for the pattern).
3. Gate any API routes the feature uses (server-side, like `app/api/dealer/report/route.ts`).
4. Test locally, deploy. **Nobody sees it yet** — flags default to off.

### Stage 1 — Canary (you)
1. Keep one test tenant for yourself (create it via Admin → Dealers if you don't have one).
2. Admin → **Rollout** → pick it as the canary tenant → click **Canary on** for your flag.
3. Open the canary's dealer page → **Enter Portal** to use the portal exactly as a dealer would.
4. Test on your phone too (PWA) — dealers are mobile-first.

### Stage 2 — Pilot (optional, 1–2 friendly dealers)
For risky changes, enable the flag for one or two real dealers from their **Features** page
(Admin → Dealers → dealer → Features) and ask how it behaves for a few days.

### Stage 3 — Live
Admin → Rollout → **Enable all**. Every active tenant gets it instantly. No redeploy.

## Rollback

Admin → Rollout → **Disable all**. The feature vanishes from every portal immediately;
the code stays deployed, so re-enabling later is also one click.

## Rules of thumb

- **Schema changes can't be flag-rolled-back.** Migrations must be additive (new tables/columns,
  never renames/drops in the same release). The flag hides the UI; the schema stays.
- **Financial-engine changes** (incentives, rebates, stock) get a longer canary: run a full report
  on the canary tenant and compare totals against the pre-change numbers before going live.
- **Add-ons are flags too.** The add-on system (`addon_*` keys) rides this same pipeline:
  canary it on your test tenant, check the locked/unlocked states, then it's live for upselling.
- One flag per update. Bundling two features under one key means you can't roll back one
  without the other.
