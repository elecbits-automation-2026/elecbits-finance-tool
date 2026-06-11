/**
 * One-time seed: provisions the dedicated admin account and the assignable
 * role-groups. It does NOT create any employee accounts or demo data — every
 * employee account is created through self-service signup and approved by the
 * admin in the Admin Console.
 *
 * Run from the project root with:
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/seed.ts
 * (or: npm run seed)
 *
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The service-role key bypasses RLS and can create users — keep it secret.
 */
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "../src/constants";

// The dedicated admin account (login: "admin" / admin@123) and the 7 assignable
// role-groups. The roles table is also seeded by migration 0004; this upsert is
// a belt-and-suspenders so `npm run seed` alone leaves a working setup.
// Admin password comes from the environment so it isn't hard-coded in the repo.
// Set ADMIN_PASSWORD in .env.local; falls back to the documented default for
// first-run convenience (change it for any real deployment).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin@123";
const ROLES = [
  { id: 0, key: "EmployeeReadOnly", label: "Employee (Read-only)", titles: "Read-only, Viewer",          rank: 0 },
  { id: 1, key: "Employee",     label: "Employee",        titles: "Emp, Junior, Intern, Executive",      rank: 1 },
  { id: 2, key: "DeptApprover", label: "Department Head", titles: "Manager, Dept Head, Reporting Manager", rank: 2 },
  { id: 3, key: "Accountant",   label: "Accountant",      titles: "Accountant",                          rank: 3 },
  { id: 4, key: "FinanceHead",  label: "Finance Head",    titles: "Finance Head",                        rank: 4 },
  { id: 5, key: "VP",           label: "Vice President",  titles: "VP",                                  rank: 5 },
  { id: 6, key: "CEO",          label: "CEO",             titles: "CEO",                                 rank: 6 },
  { id: 7, key: "SuperManager", label: "Special Access",  titles: "Special",                             rank: 7 },
];

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

async function seedAdmin() {
  let authId: string | undefined;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (created?.user) {
    authId = created.user.id;
    console.log(`created admin auth user ${ADMIN_EMAIL}`);
  } else {
    const existing = await findAuthUserByEmail(ADMIN_EMAIL);
    if (existing) {
      authId = existing.id;
      // Already exists — sync the password so rotating ADMIN_PASSWORD + re-seeding takes effect.
      const { error: upErr } = await admin.auth.admin.updateUserById(authId, { password: ADMIN_PASSWORD });
      console.log(`admin auth user exists ${ADMIN_EMAIL} — password ${upErr ? `update failed (${upErr.message})` : "synced"}`);
    } else {
      console.error(`could not create or find admin ${ADMIN_EMAIL}: ${error?.message}`);
      return;
    }
  }

  const { error: pErr } = await admin.from("profiles").upsert(
    {
      auth_id: authId,
      legacy_id: "ADMIN",
      email: ADMIN_EMAIL,
      name: "Administrator",
      dept: null,
      designation: "Administrator",
      role: "Admin",
      scope: null,
      status: "active",
    },
    { onConflict: "auth_id" }
  );
  if (pErr) console.error(`admin profile upsert failed: ${pErr.message}`);
}

async function seedRoles() {
  const { error } = await admin.from("roles").upsert(ROLES, { onConflict: "id" });
  if (error) console.error("roles seed failed:", error.message);
  else console.log(`seeded ${ROLES.length} roles`);
}

async function main() {
  await seedRoles();
  await seedAdmin();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
