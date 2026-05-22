import pg from "pg";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const SCRIPTS = [
  {
    id: randomUUID(),
    sort_order: 1,
    title: "Infinite Sukoon Loop Pitch",
    body: `INFINITE SUKOON — Closing Script for Hesitant Buyers

Jab customer ruka hua ho ya soch raha ho, yeh loop use karein:

STEP 1 — Pain identify karein:
"Aapka current phone mein kya problem hai? Camera? Battery? Speed?"

STEP 2 — OPPO ka solution dein:
- Camera problem → "OPPO ka [MODEL] mein [X]MP camera hai — raat ko bhi crystal clear photos"
- Battery → "5000mAh battery + SUPERVOOC fast charging — 30 min mein 50%"
- Speed → "Latest Snapdragon/MediaTek chipset — koi lag nahi"

STEP 3 — Price objection handle karein:
"Yeh ek baar ki investment hai — [X] saal chalna hai yeh phone. Daily [PKR per day] ban ta hai!"

STEP 4 — Easy installment mention karein:
"Aaj zero down payment ke saath bhi le ja sakte hain — monthly [AMOUNT] mein"

STEP 5 — Social proof:
"Is mahine [X] customers ne yahi model liya hai — sabki feedback bohat achi hai"

STEP 6 — Urgency/scarcity:
"Yeh color ka ek hi piece bacha hai — kal guarantee nahi"

STEP 7 — Trial close:
"Aap OPPO A-series mein zyada comfortable hain ya Reno series?"

STEP 8 — Final close:
"Main packing karta hoon — aap cash dein ge ya card?"`,
  },
  {
    id: randomUUID(),
    sort_order: 2,
    title: "OPPO Reciprocity Reminder",
    body: `RECIPROCITY SCRIPT — Loyal & Returning Customers

Jab customer pehle aa chuka ho ya referral se aaya ho:

OPENING:
"Aap hamare VIP customer hain — aapke liye kuch special arrange kiya hai"

STEP 1 — Previous purchase acknowledge karein:
"Pichli baar aapne [MODEL] liya tha — kaisa chal raha hai?"
(Agar koi issue tha: "Hum ensure karenge is baar experience aur bhi better ho")

STEP 2 — Exclusive offer frame karein:
"Yeh deal main publicly nahi deta — sirf regular customers ko"
"Aapke liye [X] discount / free screen protector / accessory arrange kar sakta hoon"

STEP 3 — Family/friends frame:
"Aapke ghar mein kisi ko bhi phone chahiye ho — aap mere pass aajana, main khyal rakhunga"

STEP 4 — Referral offer:
"Agar koi dost ya family member refer karein, aapko [BENEFIT] milega"
"Main unka number note kar leta hoon — unhe bhi best price dunga"

STEP 5 — Loyalty close:
"Aap humara shukriya ada kar ke aye hain — main ensure karta hoon aap khush jao"
"Chaliye, main aapke liye best available deal nikal ta hoon"

ALWAYS: Note customer name + phone in Customer DB after every sale.`,
  },
  {
    id: randomUUID(),
    sort_order: 3,
    title: "Anti-Snake IMEI Verification Checklist",
    body: `ANTI-SNAKE IMEI CHECKLIST — Before Every Sale

Complete BEFORE handing phone to customer:

BOX VERIFICATION:
☐ Box IMEI (sticker) padhein
☐ Phone: Settings → About Phone → IMEI se match karein
☐ Box ke andar sticker ke saath bhi match karein (agar hai)

OPPO PAKISTAN VERIFICATION:
☐ care.oppo.com/pk ya OPPO Care app pe IMEI enter karein
☐ "Original OPPO Product" confirm hona chahiye
☐ Warranty start date check karein — nahi honi chahiye (new device)

PHYSICAL CHECKS:
☐ Box sealing — original factory seal hona chahiye, koi tape nahi
☐ Cellophane wrap fresh ho — peeled/rewrapped ke signs nahi
☐ Charger, cable, earphones — original bags mein sealed
☐ Warranty card — blank hona chahiye (koi writing nahi)
☐ Screen — koi scratches ya smudges nahi
☐ Battery % — usually 50-70% (fully charged = suspicious)

IMEI CROSS CHECK TRICK:
*#06# dial karein → IMEI display hona chahiye → box se match karein

IF ANYTHING FAILS:
→ DO NOT sell this unit
→ Immediately report to admin
→ Separate from sellable stock

"Ek minute laga ke check karein — lifetime ka satisfaction secure karein"`,
  },
  {
    id: randomUUID(),
    sort_order: 4,
    title: "Repacked-Box Detection Guide",
    body: `REPACKED BOX DETECTION — Warning Signs to Check

Yeh signs dekh kar immediately REJECT karein:

EXTERNAL BOX:
⚠ Koi tape, glue, ya residue box pe
⚠ IMEI sticker crooked, bubbled, ya re-applied lagta hai
⚠ Box ka color/print uneven ya faded hai
⚠ Cellophane edges pe poorly rewrapped ya already torn
⚠ "Made in China" seal missing ya damaged

INSIDE BOX:
⚠ Accessories plastic bags mein fold marks (use ho chuki hain)
⚠ Foam insert mein dents ya marks
⚠ Warranty card mein koi writing ya stamp

CHARGER & CABLE:
⚠ Charger pins pe marks ya use ke signs
⚠ Cable slightly bent ya kinked
⚠ USB port pe dust ya residue

PHONE ITSELF:
⚠ Screen pe micro-scratches (visible in light at angle)
⚠ Ports (USB, SIM tray, 3.5mm) mein dust
⚠ Buttons stiff ya wobbly hain
⚠ Battery 80%+ — naya phone 50-70% pe hota hai
⚠ Storage mein pehle se koi files/photos

SOFTWARE CHECKS:
⚠ Phone already activated/registered hai
⚠ Demo mode ya test mode on hai
⚠ Google account pehle se linked hai

ACTION:
→ Agar 2+ signs mile = RETURN TO SUPPLIER immediately
→ Never sell a suspicious unit — reputation ka sawaal hai
→ Log it and inform admin`,
  },
];

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL DEFAULT (now()::text)
    );
  `);

  for (const script of SCRIPTS) {
    await pool.query(
      `INSERT INTO scripts (id, title, body, sort_order, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO NOTHING`,
      [script.id, script.title, script.body, script.sort_order]
    );
  }

  console.log(`Migration complete: scripts table created, ${SCRIPTS.length} scripts seeded`);
} finally {
  await pool.end();
}
