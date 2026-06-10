import { supabase } from "./supabase";
import { ADMIN_EMAIL } from "../constants";

// The dedicated admin signs in by typing the bare username "admin"; map it to
// the real auth email. Anything containing "@" is treated as a normal email.
function resolveLoginEmail(input: string) {
  const v = input.toLowerCase().trim();
  if (v === "admin") return ADMIN_EMAIL;
  return v;
}

// Map a profiles row to the `currentUser` shape the rest of the app expects.
// `id` stays the legacy U01.. id so every existing reference keeps working.
function toUser(profile: any) {
  return {
    id: profile.legacy_id ?? profile.auth_id,
    authId: profile.auth_id,
    email: profile.email,
    name: profile.name,
    dept: profile.dept,
    designation: profile.designation,
    role: profile.role,
    scope: profile.scope ?? undefined,
    status: profile.status,
  };
}

async function profileForAuthId(authId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("auth_id", authId).maybeSingle();
  if (error) throw error;
  return data;
}

// Returns the current logged-in user (or null) — used to restore a session on load.
export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  const authUser = data.session?.user;
  if (!authUser) return null;
  const profile = await profileForAuthId(authUser.id);
  if (!profile) return null;
  return toUser(profile);
}

export async function signIn(email: string, password: string) {
  const resolved = resolveLoginEmail(email);
  const { data, error } = await supabase.auth.signInWithPassword({ email: resolved, password });
  if (error) {
    // The sign-in failed (wrong password, or a deactivated user trying their old
    // password — which no longer works because the admin reset it). The profile
    // isn't readable yet, so ask the server for the account status to show a
    // precise message instead of a raw "Invalid login credentials".
    const { data: status } = await supabase.rpc("login_status", { p_email: resolved });
    if (status === "deactivated") return { success: false as const, error: "Your account has been deactivated. Please contact your administrator." };
    if (status === "reactivating") return { success: false as const, error: 'Your account is being re-activated. Use "Reactivate account" to set a new password, then wait for admin approval.' };
    if (status === "disabled") return { success: false as const, error: "This account has been disabled." };
    if (status === "pending") return { success: false as const, error: "Your account is awaiting admin approval." };
    return { success: false as const, error: error.message };
  }

  const profile = await profileForAuthId(data.user.id);
  if (!profile) return { success: false as const, error: "No profile found for this account." };
  if (profile.status === "pending") return { success: false as const, error: "Your account is awaiting admin approval." };
  if (profile.status === "disabled") return { success: false as const, error: "This account has been disabled." };
  // 'deactivated' is intentionally allowed through: the real user's password was
  // reset on deactivation, so a successful sign-in here can only be the admin
  // using the generated access password to view this user's activity.

  return { success: true as const, user: toUser(profile) };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Self-service signup: creates the auth account and a pending profile +
// pending_signups record for an admin to assign a role/department.
export async function signUp(opts: { email: string; password: string; name: string; dept?: string; designation?: string; requestedRole?: string }) {
  const email = opts.email.toLowerCase().trim();
  // Department is mandatory: every account must belong to a department so the
  // approval workflow can route requests and scope a department head's access.
  if (!opts.dept) return { success: false as const, error: "Please select your department." };
  const { data, error } = await supabase.auth.signUp({ email, password: opts.password });
  if (error) return { success: false as const, error: error.message };

  const authId = data.user?.id;
  if (authId) {
    await supabase.from("profiles").upsert(
      {
        auth_id: authId,
        email,
        name: opts.name,
        dept: opts.dept ?? null,
        designation: opts.designation ?? null,
        role: opts.requestedRole ?? "Employee",
        status: "pending",
      },
      { onConflict: "auth_id" }
    );
    await supabase.from("pending_signups").insert({
      email,
      name: opts.name,
      dept: opts.dept ?? null,
      requested_role: opts.requestedRole ?? "Employee",
      status: "pending",
      data: opts.designation ? { designation: opts.designation } : null,
    });
  }
  return { success: true as const };
}

// ---------------------------------------------------------------------------
// Admin: review & action self-service signups (dedicated 'Admin' account only —
// the profiles_update_admin RLS policy enforces this server-side via is_admin()).
// These run from the Admin Console; the finance dashboard no longer exposes them.
// ---------------------------------------------------------------------------

// List profiles still awaiting admin approval, oldest first.
export async function listPendingSignups() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...toUser(p), createdAt: p.created_at }));
}

// Approve a pending signup: assign role/dept/designation and activate it.
export async function approveSignup(
  authId: string,
  email: string,
  opts: { role: string; dept?: string; designation?: string }
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      role: opts.role,
      dept: opts.dept ?? null,
      designation: opts.designation ?? null,
      status: "active",
    })
    .eq("auth_id", authId);
  if (error) return { success: false as const, error: error.message };

  await supabase
    .from("pending_signups")
    .update({ status: "approved" })
    .eq("email", email)
    .eq("status", "pending");
  return { success: true as const };
}

// Reject a pending signup: disable the profile so it can never sign in.
export async function rejectSignup(authId: string, email: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "disabled" })
    .eq("auth_id", authId);
  if (error) return { success: false as const, error: error.message };

  await supabase
    .from("pending_signups")
    .update({ status: "rejected" })
    .eq("email", email)
    .eq("status", "pending");
  return { success: true as const };
}

// ---------------------------------------------------------------------------
// Admin Console: manage every employee — assign roles, activate/deactivate.
// (Dedicated 'Admin' account only — enforced server-side by the
// profiles_update_admin RLS policy via is_admin().)
// ---------------------------------------------------------------------------

// The 7 assignable role-groups (reference catalog), oldest-first by rank.
export async function listRoles() {
  const { data, error } = await supabase.from("roles").select("*").order("rank", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Every employee profile (excludes the admin account itself), sorted by name.
export async function listEmployees() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("role", "Admin")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...toUser(p), createdAt: p.created_at }));
}

// Assign a role-group (profiles.role) to an employee.
export async function setEmployeeRole(authId: string, role: string) {
  const { error } = await supabase.from("profiles").update({ role }).eq("auth_id", authId);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

// Assign a department (profiles.dept) to an employee. Department drives request
// routing and a department head's visibility/approval scope, so the admin can
// (re)assign it any time — e.g. to fix accounts that signed up without one.
export async function setEmployeeDept(authId: string, dept: string) {
  const { error } = await supabase.from("profiles").update({ dept }).eq("auth_id", authId);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

// Low-level status setter used by the admin actions below:
//   active      — approve a pending account so the user can sign in
//   disabled    — reject / block an account
//   deactivated — cancel an in-progress reactivation, back to deactivated
//   reactivating — see openReactivation()
export async function setEmployeeStatus(authId: string, status: "active" | "disabled" | "deactivated" | "reactivating") {
  const { error } = await supabase.from("profiles").update({ status }).eq("auth_id", authId);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

// Open a deactivated account for reactivation. This does NOT sign the user back
// in — it sets status='reactivating', which invites the user to set a brand-new
// password from the login page ("Reactivate account"). After they do, the
// account moves to 'pending' for the admin to give final approval.
export async function openReactivation(authId: string) {
  return setEmployeeStatus(authId, "reactivating");
}

// User-facing reactivation: a 'reactivating' account chooses a new password.
// Routes the account to 'pending' (awaiting admin approval) and invalidates the
// admin access password. The user isn't authenticated here, so this goes
// through the request-reactivation edge function (service role).
export async function requestReactivation(email: string, newPassword: string) {
  const { error } = await supabase.functions.invoke("request-reactivation", {
    body: { email: email.toLowerCase().trim(), newPassword },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = await (error as any).context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* keep the generic message */ }
    return { success: false as const, error: msg };
  }
  return { success: true as const };
}

// Deactivate an account via the admin-deactivate edge function: generates a new
// password, resets the user's auth password to it, sets status='deactivated',
// and stores the password (admin-readable) so the admin can sign in AS the user
// to review their activity. Returns the generated password on success.
export async function deactivateEmployee(authId: string) {
  const { data, error } = await supabase.functions.invoke("admin-deactivate", {
    body: { targetAuthId: authId },
  });
  if (error) {
    // functions.invoke surfaces non-2xx as a FunctionsHttpError whose response
    // body carries our { error } message — unwrap it for a useful toast.
    let msg = error.message;
    try {
      const ctx = await (error as any).context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* keep the generic message */ }
    return { success: false as const, error: msg };
  }
  return { success: true as const, password: data.password as string };
}

// PERMANENTLY delete an account and erase ALL of the user's data via the
// admin-delete-user edge function: removes their requests, POs, notifications,
// any pending-signup record, access password, profile and auth user. This is
// irreversible — there is no reactivation afterward. Service-role only (deleting
// an auth user can't be done from the browser), so it goes through the function.
export async function deleteEmployee(authId: string) {
  const { error } = await supabase.functions.invoke("admin-delete-user", {
    body: { targetAuthId: authId },
  });
  if (error) {
    // functions.invoke surfaces non-2xx as a FunctionsHttpError whose response
    // body carries our { error } message — unwrap it for a useful toast.
    let msg = error.message;
    try {
      const ctx = await (error as any).context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* keep the generic message */ }
    return { success: false as const, error: msg };
  }
  return { success: true as const };
}

// Fetch the stored access passwords for deactivated users, keyed by auth_id.
// Only admins can read admin_access (RLS), so this returns {} for everyone else.
export async function getAccessPasswords(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("admin_access").select("auth_id, password");
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: any) => { map[r.auth_id] = r.password; });
  return map;
}
