ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "bill_number" text;
--> statement-breakpoint
-- Backfill: give every existing row a bill number. Rows that share the same
-- (tenant, dealer, date, reference_note) were one bulk-invoice submission and
-- become one bill; rows with a NULL reference_note were single-line entries
-- and each become their own bill. Purely a display label — no effect on
-- quantity/price/stock.
WITH grouped AS (
  SELECT
    id,
    purchase_date,
    DENSE_RANK() OVER (
      PARTITION BY tenant_id, dealer_id, purchase_date
      ORDER BY CASE WHEN reference_note IS NULL OR reference_note = '' THEN id ELSE reference_note END
    ) AS seq
  FROM purchases
)
UPDATE purchases p
SET bill_number = 'INV-' || TO_CHAR(p.purchase_date::date, 'YYMMDD') || '-' || LPAD(g.seq::text, 3, '0')
FROM grouped g
WHERE p.id = g.id AND p.bill_number IS NULL;
