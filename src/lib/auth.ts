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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolveLoginEmail(email),
    password,
  });
  if (error) return { success: false as const, error: error.message };

  const profile = await profileForAuthId(data.user.id);
  if (!profile) return { success: false as const, error: "No profile found for this account." };
  if (profile.status === "pending") return { success: false as const, error: "Your account is awaiting admin approval." };
  if (profile.status === "disabled") return { success: false as const, error: "This account has been disabled." };

  return { success: true as const, user: toUser(profile) };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Self-service signup: creates the auth account and a pending profile +
// pending_signups record for an admin to assign a role/department.
export async function signUp(opts: { email: string; password: string; name: string; dept?: string; designation?: string; requestedRole?: string }) {
  const email = opts.email.toLowerCase().trim();
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
// Admin: review & action self-service signups (SuperManager / CEO only — the
// profiles_update_admin RLS policy enforces this server-side).
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
// (Admin / SuperManager / CEO only — enforced server-side by the
// profiles_update_admin RLS policy.)
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

// Activate or deactivate an account. 'active' lets them sign in; 'disabled'
// blocks sign-in (also used to activate a pending signup).
export async function setEmployeeStatus(authId: string, status: "active" | "disabled") {
  const { error } = await supabase.from("profiles").update({ status }).eq("auth_id", authId);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}
