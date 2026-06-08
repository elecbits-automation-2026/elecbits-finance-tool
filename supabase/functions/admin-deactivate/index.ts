// admin-deactivate — Supabase Edge Function
// ----------------------------------------------------------------------------
// Deactivates an employee on behalf of the admin:
//   1. verifies the CALLER is an admin (via their JWT + is_admin())
//   2. generates a fresh password and resets the TARGET user's auth password
//   3. sets the target profile status to 'deactivated'
//   4. stores the plaintext password in admin_access (admin-readable only)
//   5. returns the password so the Admin Console can display it
//
// Resetting another user's password requires the service-role key, which must
// never live in browser code — hence this server-side function. The SUPABASE_*
// secrets below are injected automatically by the Supabase Functions runtime.
//
// Deploy:  supabase functions deploy admin-deactivate
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

// A readable, reasonably strong password: 16 chars from an unambiguous set
// (no 0/O/1/l/I) so the admin can type or read it aloud without confusion.
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
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
      .select("role, email")
      .eq("auth_id", targetAuthId)
      .maybeSingle();
    if (tErr) return json(500, { error: tErr.message });
    if (!target) return json(404, { error: "User not found" });
    if (target.role === "Admin") return json(403, { error: "Cannot deactivate an admin account" });

    const password = generatePassword();

    const { error: pwErr } = await admin.auth.admin.updateUserById(targetAuthId, { password });
    if (pwErr) return json(500, { error: `Password reset failed: ${pwErr.message}` });

    const { error: stErr } = await admin
      .from("profiles")
      .update({ status: "deactivated" })
      .eq("auth_id", targetAuthId);
    if (stErr) return json(500, { error: stErr.message });

    const { error: aaErr } = await admin
      .from("admin_access")
      .upsert(
        { auth_id: targetAuthId, password, updated_at: new Date().toISOString() },
        { onConflict: "auth_id" }
      );
    if (aaErr) return json(500, { error: aaErr.message });

    return json(200, { password, email: target.email });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
