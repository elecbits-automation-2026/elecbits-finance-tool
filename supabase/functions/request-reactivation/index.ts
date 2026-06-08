// request-reactivation — Supabase Edge Function
// ----------------------------------------------------------------------------
// User-facing step of the re-activation flow. Once an admin has "opened" a
// deactivated account (profiles.status = 'reactivating'), the user comes to the
// login page, picks a NEW password, and submits it here. This function:
//   1. looks up the target profile by email
//   2. ONLY proceeds if its status is exactly 'reactivating' (the admin's gate)
//   3. sets the user's auth password to the new one they chose
//   4. moves the profile to 'pending' (awaiting final admin approval)
//   5. deletes the stored admin access password — it no longer works
//
// The caller is NOT authenticated (the account can't sign in yet), so the only
// authorization is the 'reactivating' status the admin set. Setting another
// user's password needs the service-role key, hence this server-side function.
//
// Note: the function is reachable with the project's anon key (Supabase verifies
// it as a JWT). Anyone with that key could call it for an email that is in the
// 'reactivating' state — but that window only exists after an admin explicitly
// opened it, and the admin still has to approve the result. Acceptable for an
// internal tool.
//
// Deploy:  supabase functions deploy request-reactivation

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").toLowerCase().trim();
    const newPassword = String(body?.newPassword ?? "");
    if (!email) return json(400, { error: "Email is required." });
    if (newPassword.length < 6) return json(400, { error: "Password must be at least 6 characters." });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("auth_id, status")
      .eq("email", email)
      .maybeSingle();
    if (pErr) return json(500, { error: pErr.message });
    if (!profile) return json(404, { error: "No account found for that email." });
    if (profile.status !== "reactivating") {
      return json(403, { error: "This account isn't open for re-activation. Ask your administrator to start it." });
    }

    const { error: pwErr } = await admin.auth.admin.updateUserById(profile.auth_id, { password: newPassword });
    if (pwErr) return json(500, { error: `Could not set password: ${pwErr.message}` });

    const { error: stErr } = await admin
      .from("profiles")
      .update({ status: "pending" })
      .eq("auth_id", profile.auth_id);
    if (stErr) return json(500, { error: stErr.message });

    // The old admin access password is now meaningless — drop it.
    await admin.from("admin_access").delete().eq("auth_id", profile.auth_id);

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
