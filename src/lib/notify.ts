import { supabase } from "./supabase";

// Fire-and-forget: ask the `notify-approvers` edge function to email whoever is
// now next in line to act on this document (or the requester, when it was just
// rejected). The function reads the row fresh and decides recipients from its
// CURRENT stage/status, so call this AFTER the save that changed the row.
//
// Never awaited and never throws into the caller: a notification failure must
// not block or fail the underlying workflow action. Auth is attached
// automatically by supabase-js (the signed-in user's JWT).
export function notifyWorkflow(table: "requests" | "budgets" | "pos", id: string) {
  supabase.functions
    .invoke("notify-approvers", { body: { table, id } })
    .catch((e) => console.warn("notifyWorkflow (non-blocking) failed:", e?.message ?? e));
}
