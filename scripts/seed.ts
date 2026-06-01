/**
 * One-time seed: creates the 21 employee auth accounts + profiles, and loads
 * the demo budgets / purchase orders. Safe to re-run (idempotent upserts).
 *
 * Run from the project root with:
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/seed.ts
 * (or: npm run seed)
 *
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The service-role key bypasses RLS and can create users — keep it secret.
 */
import { createClient } from "@supabase/supabase-js";
import { USERS, SEED_BUDGETS, SEED_POS } from "../src/constants";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findAuthUserByEmail(email: string) {
  // paginate through users (fine for a small org)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function seedUsers() {
  for (const u of USERS) {
    let authId: string | undefined;

    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (created?.user) {
      authId = created.user.id;
      console.log(`created auth user ${u.email}`);
    } else {
      // Likely already exists — look it up.
      const existing = await findAuthUserByEmail(u.email);
      if (existing) {
        authId = existing.id;
        console.log(`auth user exists ${u.email}${error ? ` (${error.message})` : ""}`);
      } else {
        console.error(`could not create or find ${u.email}: ${error?.message}`);
        continue;
      }
    }

    const { error: pErr } = await admin.from("profiles").upsert(
      {
        auth_id: authId,
        legacy_id: u.id,
        email: u.email,
        name: u.name,
        dept: u.dept,
        designation: u.designation,
        role: u.role,
        scope: (u as any).scope ?? null,
        status: "active",
      },
      { onConflict: "auth_id" }
    );
    if (pErr) console.error(`profile upsert failed for ${u.email}: ${pErr.message}`);
  }
}

function num(o: any) {
  return o.amountINR ?? o.amount ?? null;
}

async function seedBudgets() {
  const rows = SEED_BUDGETS.map((o: any) => ({
    id: o.id, type: o.type ?? null, dept: o.dept ?? null, status: o.status ?? null,
    current_stage: o.currentStage ?? null, amount_inr: num(o), data: o,
  }));
  const { error } = await admin.from("budgets").upsert(rows, { onConflict: "id" });
  if (error) console.error("budgets seed failed:", error.message);
  else console.log(`seeded ${rows.length} budgets`);
}

async function seedPOs() {
  const rows = SEED_POS.map((o: any) => ({
    id: o.id, po_number: o.poNumber ?? null, requester_id: o.requesterId ?? null, dept: o.dept ?? null,
    status: o.status ?? null, current_stage: o.currentStage ?? null, amount_inr: num(o), data: o,
  }));
  const { error } = await admin.from("pos").upsert(rows, { onConflict: "id" });
  if (error) console.error("pos seed failed:", error.message);
  else console.log(`seeded ${rows.length} purchase orders`);
}

async function seedCounter() {
  const { error } = await admin.from("app_meta").upsert(
    { key: "po_counter", value: 2, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) console.error("po_counter seed failed:", error.message);
  else console.log("seeded po_counter = 2");
}

async function main() {
  await seedUsers();
  await seedBudgets();
  await seedPOs();
  await seedCounter();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
