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
//   4. send each an email (in-house Gmail API, or Resend)
//
// Reading the row server-side (not trusting client-sent state) means the email
// always reflects what actually persisted — including the server workflow guards.
//
// Required function secrets (supabase secrets set ...):
//   Email provider — configure ONE of the two (Gmail is preferred when both set):
//     A) Gmail API (in-house):
//        GMAIL_CLIENT_ID      - OAuth2 client id (Google Cloud project, Gmail API enabled)
//        GMAIL_CLIENT_SECRET  - OAuth2 client secret
//        GMAIL_REFRESH_TOKEN  - refresh token for the sending mailbox, scope gmail.send
//                               (one-time consent as e.g. noreply@elecbits.in)
//     B) Resend (third-party):
//        RESEND_API_KEY       - Resend API key
//   NOTIFY_FROM      - verified sender, e.g. "Elecbits Finance <noreply@elecbits.in>"
//                      (for Gmail this MUST be the mailbox the refresh token belongs to)
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

// Format an ISO timestamp in IST (the team's timezone) for the email body.
const fmtIST = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d) + " IST";
};

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

// --- Gmail API send helpers --------------------------------------------------
// We send over the Gmail REST API (HTTPS) rather than SMTP because Supabase Edge
// Functions block outbound SMTP ports (25/465/587). Auth is an OAuth2 refresh
// token for a dedicated sending mailbox, scope gmail.send only.
const textEnc = new TextEncoder();

// standard base64 of raw bytes (MIME body + RFC 2047 encoded-word headers)
const b64 = (bytes: Uint8Array) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
// URL-safe base64, padding stripped — Gmail's `raw` wire format
const b64url = (bytes: Uint8Array) =>
  b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
// RFC 2047 encoded-word so non-ASCII (e.g. the ₹ sign) is legal in a header
const encHeader = (s: string) =>
  /[^\x00-\x7F]/.test(s) ? `=?UTF-8?B?${b64(textEnc.encode(s))}?=` : s;

// Build a base64url-encoded RFC 2822 message for users.messages.send.
function buildRawMessage(from: string, to: string, subject: string, html: string): string {
  const body = (b64(textEnc.encode(html)).match(/.{1,76}/g) ?? []).join("\r\n");
  const msg =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${encHeader(subject)}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `\r\n` +
    body;
  return b64url(textEnc.encode(msg));
}

// Exchange the long-lived refresh token for a short-lived access token.
async function gmailAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET") ?? "",
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const j = await res.json();
  if (!j.access_token) throw new Error("no access_token in token response");
  return j.access_token as string;
}

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

    // 4. Send. Prefer the in-house Gmail API path when configured; fall back to
    //    Resend; otherwise no-op gracefully (so callers never error pre-config).
    const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") ?? "Elecbits Finance <onboarding@resend.dev>";
    const APP_URL = Deno.env.get("APP_URL") ?? "";

    const provider = GMAIL_REFRESH_TOKEN ? "gmail" : RESEND_API_KEY ? "resend" : "none";
    if (provider === "none") {
      return json(200, {
        sent: 0,
        would_notify: targets.map((t) => t.email),
        note: "no email provider configured (set GMAIL_REFRESH_TOKEN or RESEND_API_KEY)",
      });
    }

    // For Gmail, mint one access token up front and reuse it for every recipient.
    let gmailToken = "";
    if (provider === "gmail") {
      try {
        gmailToken = await gmailAccessToken();
      } catch (e) {
        return json(502, { error: `Gmail auth failed: ${String((e as Error)?.message ?? e)}` });
      }
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
      const lastEntry = history.length ? history[history.length - 1] : null;
      const lastComment = lastEntry ? String(lastEntry.comments || "") : "";
      // When the document reached the current approver (for a freshly raised
      // document this is the submit time).
      const raisedAt = fmtIST(String(lastEntry?.at || ""));
      const html = isReject
        ? `<p>Hi ${t.name || ""},</p>
           <p>Your <strong>${docLabel} ${id}</strong> (${amtL}) was <strong>rejected</strong>.</p>
           ${lastComment ? `<p><em>Reason:</em> ${lastComment}</p>` : ""}
           ${link}`
        : `<p>Hi ${t.name || ""},</p>
           <p><strong>${docLabel} ${id}</strong> (${amtL}) from <strong>${requesterName}</strong> is awaiting your <strong>${stageLabel(stage)}</strong>.</p>
           ${raisedAt ? `<p><em>Raised:</em> ${raisedAt}</p>` : ""}
           ${lastComment ? `<p><em>Latest note:</em> ${lastComment}</p>` : ""}
           ${link}
           <p style="color:#64748b;font-size:12px">You're receiving this because you're the next approver in this document's workflow.</p>`;

      const res =
        provider === "gmail"
          ? await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
              method: "POST",
              headers: { Authorization: `Bearer ${gmailToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ raw: buildRawMessage(NOTIFY_FROM, t.email, subject, html) }),
            })
          : await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: NOTIFY_FROM, to: [t.email], subject, html }),
            });
      if (res.ok) sent++;
      else failures.push(`${t.email}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
    }

    return json(200, { sent, provider, recipients: targets.map((t) => t.email), reason, stage, ...(failures.length ? { failures } : {}) });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
