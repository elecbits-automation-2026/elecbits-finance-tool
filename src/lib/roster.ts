import { USERS } from "../constants";

// Live roster of users (the Supabase `profiles` table), populated once after sign-in
// via setRoster(). Approval-routing and notification helpers read this through
// getRoster() so a department head an admin creates at runtime is recognised without
// a redeploy. Until the live roster loads — and in seed scripts / tests that never
// call setRoster() — it falls back to the seeded USERS, so behaviour is unchanged for
// the seeded organisation.
let roster: any[] = USERS;

export function setRoster(users: any[]) {
  roster = Array.isArray(users) && users.length > 0 ? users : USERS;
}

export function getRoster(): any[] {
  return roster;
}
