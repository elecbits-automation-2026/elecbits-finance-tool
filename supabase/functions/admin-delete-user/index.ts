// admin-delete-user — Supabase Edge Function
// ----------------------------------------------------------------------------
// PERMANENTLY deletes an employee and erases ALL of their data on behalf of the
// admin. Unlike admin-deactivate (reversible), this is irreversible:
//   1. verifies the CALLER is an admin (via their JWT + is_admin())
//   2. refuses to delete an 'Admin' account
//   3. deletes everything the user owns, keyed by their legacy_id (U01..):
//        - requests       WHERE requester_id = legacy_id
//        - pos            WHERE requester_id = legacy_id
//        - notifications  WHERE to_user_id   = legacy_id
//        - pending_signups WHERE email       = email
//        - admin_access    (also cascades, but removed explicitly)
//   4. deletes the auth.users row, which CASCADES to profiles (and admin_access)
//
// We intentionally do NOT scrub this user's name/legacy_id out of OTHER users'
// records (e.g. shared requests where they were an approver in data.history) —
// rewriting another employee's workflow history is out of scope and would
// corrupt the audit trail. Only the deleted user's OWN rows are erased.
//
// Deleting an auth user requires the service-role key, which must never live in
// browser code — hence this server-side function. The SUPABASE_* secrets are
// injected automatically by the Supabase Functions runtime.
//
// Deploy:  supabase functions deploy admin-delete-user
// (No extra secrets needed — SERVICE_ROLE/URL/ANON are provided by default.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1. Verify the caller is a signed-in admin, using THEIR token.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: who, error: whoErr } = await caller.auth.getUser();
    if (whoErr || !who?.user) return json(401, { error: "Not authenticated" });
    const { data: isAdmin, error: adminErr } = await caller.rpc("is_admin");
    if (adminErr) return json(500, { error: adminErr.message });
    if (!isAdmin) return json(403, { error: "Admin access required" });

    const body = await req.json().catch(() => ({}));
    const targetAuthId = body?.targetAuthId as string | undefined;
    if (!targetAuthId) return json(400, { error: "targetAuthId is required" });

    // 2. Service-role client for the privileged operations.
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("legacy_id, role, email")
      .eq("auth_id", targetAuthId)
      .maybeSingle();
    if (tErr) return json(500, { error: tErr.message });
    if (!target) return json(404, { error: "User not found" });
    if (target.role === "Admin") return json(403, { error: "Cannot delete an admin account" });

    // 3. Erase everything the user owns. References across the finance tables use
    // the legacy_id (U01..), not the auth UUID. Guard against a missing legacy_id
    // so we never run an unscoped delete.
    const legacyId = target.legacy_id as string | null;
    if (legacyId) {
      const { error: rErr } = await admin.from("requests").delete().eq("requester_id", legacyId);
      if (rErr) return json(500, { error: `Deleting requests failed: ${rErr.message}` });

      const { error: pErr } = await admin.from("pos").delete().eq("requester_id", legacyId);
      if (pErr) return json(500, { error: `Deleting POs failed: ${pErr.message}` });

      const { error: nErr } = await admin.from("notifications").delete().eq("to_user_id", legacyId);
      if (nErr) return json(500, { error: `Deleting notifications failed: ${nErr.message}` });
    }

    if (target.email) {
      const { error: sErr } = await admin.from("pending_signups").delete().eq("email", target.email);
      if (sErr) return json(500, { error: `Deleting signup record failed: ${sErr.message}` });
    }

    // admin_access cascades when the profile is removed, but delete it explicitly
    // so a failure here surfaces before we drop the irreversible auth user.
    const { error: aaErr } = await admin.from("admin_access").delete().eq("auth_id", targetAuthId);
    if (aaErr) return json(500, { error: `Deleting access record failed: ${aaErr.message}` });

    // 4. Delete the auth user — cascades to profiles (and admin_access). This is
    // the irreversible step, done last so the data cleanup above can't be
    // orphaned if it fails.
    const { error: delErr } = await admin.auth.admin.deleteUser(targetAuthId);
    if (delErr) return json(500, { error: `Deleting account failed: ${delErr.message}` });

    return json(200, { email: target.email });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
