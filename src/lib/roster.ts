// Live roster of users (the Supabase `profiles` table), populated once after sign-in
// via setRoster(). Approval-routing and notification helpers read this through
// getRoster() so a department head an admin creates at runtime is recognised without
// a redeploy. Until the live roster loads — or if it fails to load — this stays an
// empty array; there is no hard-coded fallback roster.
let roster: any[] = [];

export function setRoster(users: any[]) {
  roster = Array.isArray(users) ? users : [];
}

export function getRoster(): any[] {
  return roster;
}
