import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://postgres.tistjyrldecrdnljctid:giJ5nvgiR0Gemsjm@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
});

// Check what's in app_settings
const settings = await pool.query("SELECT key, value FROM app_settings");
console.log("app_settings:", JSON.stringify(settings.rows));

// Generate fresh hash for 123456
const newHash = await bcrypt.hash("123456", 10);
console.log("New hash for 123456:", newHash);

// Upsert the pin hash
await pool.query(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES ('app_pin_hash', $1, now()::text)
  ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()::text
`, [newHash]);

console.log("PIN reset to 123456 in app_settings");
await pool.end();
