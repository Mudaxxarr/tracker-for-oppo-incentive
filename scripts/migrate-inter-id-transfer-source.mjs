import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL environment variable is required");

const { Pool } = pg;
const pool = new Pool({ connectionString: url });

// Reclassify inbound inter-ID transfer purchases from REGULAR → INTER_ID_TRANSFER_IN
// so the receiving ID no longer earns stock-in / target-bonus credit on stock it
// received via transfer (owner rule: that credit belongs to the purchaser only).
// The accept flow stamps exactly this referenceNote; nothing else uses it.
const res = await pool.query(`
  UPDATE purchases
  SET source = 'INTER_ID_TRANSFER_IN'
  WHERE source = 'REGULAR'
    AND reference_note LIKE 'Inter-ID transfer in (%'
`);

console.log(`✅ Reclassified ${res.rowCount} inbound inter-ID transfer purchase(s) → INTER_ID_TRANSFER_IN`);
await pool.end();
