// notify-approvers — Supabase Edge Function
// ----------------------------------------------------------------------------
// Emails the user(s) who are now next in line to act on a workflow document
// (budget / payment / PO / PI), or the requester when it was rejected. Invoked
// fire-and-forget by the client after a successful submit or approve/reject.
//
// Flow:
//   1. verify the CALLER is signed in (their JWT)
//   2. service-role read the row fresh from the given table + id
//   3. resolve the recipient(s) from the row's CURRENT stage/status
//      (mirrors getEligibleDeptApprovers + the role-per-stage routing)
//   4. send each an email via Resend
//
// Reading the row server-side (not trusting client-sent state) means the email
// always reflects what actually persisted — including the server workflow guards.
//
// Required function secrets (supabase secrets set ...):
//   RESEND_API_KEY   - Resend API key
//   NOTIFY_FROM      - verified sender, e.g. "Elecbits Finance <noreply@yourdomain.com>"
//   APP_URL          - app base URL for the "Open" link (e.g. your Vercel URL)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.
//
// Deploy: supabase functions deploy notify-approvers

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const ALLOWED_TABLES = new Set(["requests", "budgets", "pos"]);

// app_user_id() equivalent: a profile is identified by legacy_id when present,
// else its auth_id as text. Must match public.app_user_id / profileToUser.
const appId = (p: any) => p.legacy_id ?? String(p.auth_id);

const kindLabel = (k: string) =>
  ({ Payment: "Payment", Budget: "Budget", PO: "Purchase Order", PI: "Proforma Invoice" }[k] || k || "Request");

const stageLabel = (s: string) =>
  ({
    BoxBuildMid: "Delivery Head approval",
    DeptApproval: "Department Head approval",
    VP: "VP approval",
    CEO: "CEO approval",
    SuperManagerApproval: "SuperManager approval",
    FinanceHead: "Finance Head approval",
    Accountant: "Accountant processing",
    Processing: "Accountant processing",
  }[s] || s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1. Caller must be a signed-in user (prevents anonymous send abuse).
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: who, error: whoErr } = await caller.auth.getUser();
    if (whoErr || !who?.user) return json(401, { error: "Not authenticated" });

    const body = await req.json().catch(() => ({}));
    const table = body?.table as string | undefined;
    const id = body?.id as string | undefined;
    if (!table || !ALLOWED_TABLES.has(table)) return json(400, { error: "valid 'table' is required" });
    if (!id) return json(400, { error: "'id' is required" });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 2. Read the row fresh.
    const { data: row, error: rErr } = await admin.from(table).select("*").eq("id", id).maybeSingle();
    if (rErr) return json(500, { error: rErr.message });
    if (!row) return json(404, { error: "row not found" });

    const data = row.data ?? {};
    const stage: string = row.current_stage ?? data.currentStage ?? "";
    const status: string = row.status ?? data.status ?? "";
    const kind: string = data.kind ?? row.kind ?? "Request";
    const requesterId: string = row.requester_id ?? data.requesterId ?? "";
    const requesterName: string = data.requesterName ?? "A teammate";
    const amountINR: number = Number(row.amount_inr ?? data.amountINR ?? 0);
    const history: any[] = Array.isArray(data.history) ? data.history : [];

    // 3. Resolve recipients from the current state.
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("legacy_id, auth_id, email, name, role, status")
      .eq("status", "active");
    if (pErr) return json(500, { error: pErr.message });
    const active = profiles ?? [];

    let recipients: any[] = [];
    let reason = "";

    if (status === "Rejected" || stage === "Rejected") {
      // Notify the requester their document was rejected.
      recipients = active.filter((p) => appId(p) === requesterId);
      reason = "rejected";
    } else if (stage === "DeptApproval") {
      const sel: string[] = Array.isArray(data.selectedApprovers) ? data.selectedApprovers : [];
      const alreadyApproved = new Set(
        history.filter((h) => String(h.action || "").includes("Approved")).map((h) => h.byId),
      );
      recipients = active.filter(
        (p) => sel.includes(appId(p)) && appId(p) !== requesterId && !alreadyApproved.has(appId(p)),
      );
      reason = "pending";
    } else {
      const roleForStage: Record<string, string> = {
        BoxBuildMid: "BoxBuildMidApprover",
        FinanceHead: "FinanceHead",
        VP: "VP",
        CEO: "CEO",
        SuperManagerApproval: "SuperManager",
        Accountant: "Accountant",
        Processing: "Accountant",
      };
      const role = roleForStage[stage];
      if (!role) return json(200, { sent: 0, skipped: `no recipients for stage '${stage}'` });
      recipients = active.filter((p) => p.role === role && appId(p) !== requesterId);
      reason = "pending";
    }

    // de-dupe by email
    const byEmail = new Map<string, any>();
    for (const r of recipients) if (r.email) byEmail.set(r.email.toLowerCase(), r);
    const targets = [...byEmail.values()];
    if (targets.length === 0) return json(200, { sent: 0, skipped: "no active recipients" });

    // 4. Send via Resend (no-op gracefully if not configured yet).
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") ?? "Elecbits Finance <onboarding@resend.dev>";
    const APP_URL = Deno.env.get("APP_URL") ?? "";
    if (!RESEND_API_KEY) {
      return json(200, { sent: 0, would_notify: targets.map((t) => t.email), note: "RESEND_API_KEY not set" });
    }

    const docLabel = kindLabel(kind);
    const amtL = `₹${(amountINR / 100000).toFixed(2)}L`;
    const link = APP_URL ? `<p><a href="${APP_URL}">Open the finance tool →</a></p>` : "";

    let sent = 0;
    const failures: string[] = [];
    for (const t of targets) {
      const isReject = reason === "rejected";
      const subject = isReject
        ? `Your ${docLabel} ${id} was rejected`
        : `[Action needed] ${docLabel} ${id} — ${amtL} awaiting your ${stageLabel(stage)}`;
      const lastComment = history.length ? String(history[history.length - 1].comments || "") : "";
      const html = isReject
        ? `<p>Hi ${t.name || ""},</p>
           <p>Your <strong>${docLabel} ${id}</strong> (${amtL}) was <strong>rejected</strong>.</p>
           ${lastComment ? `<p><em>Reason:</em> ${lastComment}</p>` : ""}
           ${link}`
        : `<p>Hi ${t.name || ""},</p>
           <p><strong>${docLabel} ${id}</strong> (${amtL}) from <strong>${requesterName}</strong> is awaiting your <strong>${stageLabel(stage)}</strong>.</p>
           ${lastComment ? `<p><em>Latest note:</em> ${lastComment}</p>` : ""}
           ${link}
           <p style="color:#64748b;font-size:12px">You're receiving this because you're the next approver in this document's workflow.</p>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: NOTIFY_FROM, to: [t.email], subject, html }),
      });
      if (res.ok) sent++;
      else failures.push(`${t.email}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
    }

    return json(200, { sent, recipients: targets.map((t) => t.email), reason, stage, ...(failures.length ? { failures } : {}) });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
