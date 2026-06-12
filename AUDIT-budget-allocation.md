# Budget Allocation — Security & Correctness Audit

**Scope:** Budget allocation only (Project / Monthly / Extension budgets + R&D cap allocation),
the approval/rejection workflow that drives them, and the data layer they write through.
**Method:** Static analysis of the React client + Supabase schema/RLS + edge functions. `npx tsc --noEmit` = clean.
**Not done:** live runtime testing against your Supabase project (no credentials in the workspace).

---

## 0. Test log

```
[CHECK] tsc --noEmit ............................. PASS (0 errors)
[CHECK] RLS on budgets/requests/pos/notifications  FAIL — `using(true) with check(true)` (world RW for any authed user)
[CHECK] server-side approval state machine ....... FAIL — none exists; transitions computed in browser only
[CHECK] server-side amount/cap enforcement ....... FAIL — 80% rule, R&D cap, margin all client-only
[CHECK] segregation of duties (raiser != approver) FAIL — dept head can approve own monthly budget
[CHECK] write model (per-row vs whole-array) ..... FAIL — replaceAll() rewrites + prunes whole table per save
[CHECK] concurrent approval safety ............... FAIL — last-writer-wins, deletes other users' changes
[CHECK] data scoping on fetch .................... FAIL — every browser downloads every dept's budgets+attachments
[CHECK] unapproved-account session .............. FAIL — self-signup / pending login leaves a usable authed session
[CHECK] audit trail integrity .................... FAIL — history[] is client-written jsonb, forgeable
[CHECK] deterministic-id collisions .............. WARN — RDCAP-/RDCAPREQ- ids are guessable & overwritable
[CHECK] R&D usage month accounting ............... WARN — double-counts across created/approved months
```

---

## 1. Severity summary

| # | Finding | Severity |
|---|---------|----------|
| C1 | Any authenticated user can read AND write every budget/request/PO row directly (RLS `using(true)`) | **Critical** |
| C2 | Whole approval workflow is client-side only — self-approve or jump a budget straight to `Active` | **Critical** |
| C3 | `replaceAll` write model lets any user wipe all budgets, and silently loses concurrent edits | **Critical** |
| C4 | Self-signup / pending login leaves a real authenticated Supabase session → C1 with an attacker-chosen password | **Critical** |
| C5 | Full financial data (all depts, salaries, client values, base64 attachments) sent to every browser | **High** |
| H1 | Dept head can approve their **own** monthly budget / extension (no raiser≠approver rule) | **High** |
| H2 | Requester's browser sets `selectedApprovers` and `currentStage` → can name self as approver | **High** |
| H3 | R&D cap allocation has no workflow; one SuperManager (or any user via C1) sets any cap | **High** |
| H4 | `amountINR`, `approvedBy`, `history` are forgeable jsonb — audit trail untrustworthy | **High** |
| M1 | Multi-approver count keys off exact history string `"Approved (Dept)"` — fragile | Medium |
| M2 | `getRDUsageForDeptMonth` double-counts a budget in both created & approved month | Medium |
| M3 | Deterministic ids (`RDCAP-…`, `BUD-${Date.now()}`) → overwrite/collision risk | Medium |
| M4 | No DB uniqueness on active budget per `projectId`; client check is racy | Medium |
| L1 | `rd*` reductions assume `amountINR` present → NaN on legacy rows | Low |

---

## 2. Critical findings (the root cause)

### C1 — The server trusts every authenticated user with full read/write

`supabase/schema.sql` lines 185–198:

```sql
foreach t in array array['requests','budgets','pos','notifications','app_meta']
  create policy ..._auth_all on public.t
    for all to authenticated using (true) with check (true);
```

The schema even states the trust model explicitly (lines 23–25): *"any AUTHENTICATED employee can read/write the shared finance tables; role/dept gating is done in the app."*

Consequence: the anon key ships in the browser, the `supabase` client is already imported, so any logged-in employee can open DevTools and run:

```js
// Approve nothing — just insert an already-Active budget:
await supabase.from('budgets').upsert({
  id: 'BUD-hack', type: 'Monthly', dept: 'Marketing', status: 'Active',
  current_stage: 'Active', amount_inr: 5000000,
  data: { id:'BUD-hack', kind:'Budget', status:'Active', currentStage:'Active',
          amountINR:5000000, approvedBy:'CEO (forged)', history:[/* fabricated */] }
});
```

Everything in `access.ts` (`canUserActOnRequest`, `canUserSeeRequest`) and `workflow.ts` (`computeNextStage`) is **UI decoration**. None of it runs server-side.

### C2 — The approval state machine lives in the browser

`ActionButtons.doAction()` computes the next stage client-side and writes it back. There is no server step that re-derives or validates the transition, checks the actor's role, or enforces stage order. Combined with C1, the entire Dept Head → VP → CEO → Finance Head → Active chain is advisory. A ≥₹5L budget that's supposed to need VP **and** CEO can be set to `Active` in one write.

### C3 — `replaceAll` = whole-table rewrite + prune

`src/lib/db.ts` `replaceAll()` upserts the **entire** array the browser holds, then **deletes every row whose id isn't in that array**:

```js
del = del.not("id", "in", `(${keepIds...})`)   // anything not in my snapshot → DELETED
```

Two real failure modes:
1. **Destruction:** `await supabase.from('budgets').delete().neq('id','')` — or simply `saveBudgets([])` in app code on a bad state — erases all budgets. No server guard, no soft-delete, no audit.
2. **Lost updates (will happen in normal use):** every save is read-modify-write of the full collection from in-memory state. If Dept Head A approves budget X while Employee B submits budget Y from another session, the second save overwrites with a stale array — and because non-present ids are *deleted*, the first change doesn't just go stale, it **disappears**. With "every user in every dept" acting on budgets, this is a guaranteed data-loss bug.

### C4 — Unapproved accounts get a usable session

`signUp()` (auth.ts:78) creates the auth user; with email confirmation off (which `schema.sql` instructs you to do, line 296), `supabase.auth.signUp` returns a **live, persisted session**. The new account is `status:'pending'` and the UI refuses to show the dashboard — but the Supabase client is already authenticated, so under C1 the attacker has full read/write to every finance table with a password they chose, no admin approval, no email check.

`signIn()` has the same shape: for a `pending`/`disabled` account it succeeds at the auth layer (establishing the session) and then `return { success:false }` **without calling `supabase.auth.signOut()`** (auth.ts:62–64). The session persists.

---

## 3. Budget-allocation workflow loopholes

### H1 — A department head can approve their own budget
`getEligibleDeptApprovers()` for a normal dept returns `deptApprovers().filter(approverScopeCovers(...))` — which **includes the requester** when the requester is themselves a DeptApprover raising a Monthly budget or Extension (only heads can raise those). At the `DeptApproval` stage, `canUserActOnRequest` allows it: `selectedApprovers.includes(user.id)` is true and `hasApproved` is false. The Executive/Management chains explicitly exclude `u.id !== requester.id`, but the ordinary dept path does not. **A head self-approves their own department budget.**

### H2 — The requester chooses their own approvers and starting stage
`selectedApprovers` and `currentStage` are computed in `NewBudgetRequestForm.submit()` in the requester's browser and written verbatim. Even without console tricks, the raiser controls who is listed as approver and what stage the item starts at. With C1, they set `currentStage:'Active'` directly.

### H3 — R&D cap allocation has no approval at all
`RDAllocationView.save()` writes `status:'Active'` straight to `budgets`. In-app it's gated only by the client tab (`user.role === 'SuperManager'`); under C1 **any** employee can create an `RDCap` of any size for any department, which then unlocks R&D project budgets up to that cap. `RD_MONTHLY_CAP` (₹200k) is only a placeholder in the input — the real cap is whatever was written, so there is no hard ceiling.

### H4 — The audit trail is forgeable
`approvedBy`, `approvedDate`, `byId`, and the whole `history[]` array live inside `data jsonb`, which is fully writable. Approvals can be attributed to the CEO, timestamps fabricated, rejections erased. There is no append-only server log.

### Per-role / per-dept budget matrix (intended design — all client-enforced, all bypassable under C1)

Raising:
| Dept | Project budget | Monthly | Extension | R&D |
|------|----|----|----|----|
| ODM / Box Build / Sales (project depts) | Employee + Head | Head only | Head only | ODM only (Employee or Head), needs an RDCap allocation |
| HR / Finance / Product / Marketing (non-project) | — | Head only | Head only | — |
| Executive / Management | role-based self-chains | Head only | Head only | — |

Approving (intended chain, by amount):
| Amount | Chain |
|--------|-------|
| < ₹1L | Dept Head → Finance Head → Active |
| ₹1L–₹5L | Dept Head → VP → Finance Head → Active |
| ≥ ₹5L | Dept Head → CEO → Finance Head → Active |
| any, SuperManager acts | SuperManager → **Active** (single signature, overrides all of the above) |

Rejection: any approver at any pending stage sets `Rejected` with a mandatory reason. Correct in the UI — but, per C1, a `Rejected` budget can be flipped back to `Active` by a direct write, and an already-`Active` budget's amount can be edited by anyone (no post-approval immutability).

> **SuperManager note:** by design one "Special Access" account can drive any budget of any size straight to `Active` with no second signature. That's a large blast radius if such an account is compromised — worth a second-approver requirement for ≥₹5L even for SuperManagers.

---

## 4. Functional bugs

- **M1** `ActionButtons.tsx:138` counts approvals with `history.filter(h => h.action === "Approved (Dept)")`. Any change to that exact label (or an approval written by a different path) breaks the multi-approver tally.
- **M2** `finance.ts getRDUsageForDeptMonth` matches `approvedDate[:7]===month OR createdDate[:7]===month`. A budget created in one month and approved in another is counted in **both**, over-stating R&D usage and wrongly blocking new R&D budgets.
- **M3** Deterministic ids: `RDCAP-${dept}-${month}` / `RDCAPREQ-${dept}-${month}` are guessable and overwritable (anyone can clobber a dept's allocation by upserting that id). `BUD-${Date.now()}` collides if two budgets are created in the same millisecond and is predictable.
- **M4** Duplicate-project guard (`NewBudgetRequestForm.tsx:96`) is a client `budgets.find(...)`; no DB unique constraint. Two near-simultaneous submits both pass.
- **L1** `rdUsedThisMonth` / `getRDUsageForDeptMonth` do `s + b.amountINR`; legacy rows storing `amount` (not `amountINR`) yield `NaN`.

---

## 5. Privacy / data leak (C5)

`db.fetchAll('budgets')` is `select *` with **no filter** — `filterByAccess()` only trims what's *rendered*. So every authenticated browser downloads:
- every department's budgets, project client-order values and margins, "Salary & Payroll" monthly budgets,
- the full `history` of every request, and
- **base64 attachment blobs** embedded in `data` (proofs, invoices) for all budgets/requests/POs,
- and every user's `notifications` (amounts, names, request details — `to_user_id` is just a column under `using(true)`).

A Marketing intern can read Finance's payroll budgets and download every uploaded document. This is the single biggest confidentiality exposure.

---

## 6. Performance / faster API calls

These are real wins *and* mostly fall out of fixing the security model:

1. **Stop the whole-array rewrite.** Per single approval you currently upsert *N* rows and run a `delete … not in (<all ids>)`. Switch to a single-row `update … eq('id', id)` and a targeted `delete … eq('id', id)`. O(1) instead of O(N), and it removes the C3 deletion race.
2. **Get attachments out of `data`.** Move proofs/invoices to Supabase Storage; store a path + signed URL. Today every login pulls every base64 blob in the table. This alone can cut the initial payload by orders of magnitude.
3. **Select only what you need + filter server-side.** Once RLS scopes rows, replace `select *` with explicit columns and push `.eq('dept', …)`, `.in('status', […])`, date filters to Postgres (the `budgets_dept_idx` / `requests_status_idx` indexes already exist but are unused because filtering happens in JS after a full fetch).
4. **Use Realtime or per-table refetch** instead of reloading everything; subscribe to `budgets` changes so approvers see updates without a full reload.
5. **Do the transition in one RPC.** A single `approve_request(id, comment)` Postgres function (see §7) is one network round-trip, atomic, and avoids shipping the whole collection back.
6. **Batch is already fine** for notifications (array insert) — keep that.

---

## 7. Recommended fixes (prioritized)

**Tier 1 — close the open doors (do first):**
1. Replace `using(true) with check(true)` on `budgets`/`requests`/`pos`/`notifications` with:
   - **SELECT** scoped to the caller (requester, or a role/dept whose mandate covers the row — mirror `access.ts` in SQL), and at minimum `notifications` scoped to `to_user_id = own legacy_id`.
   - **No direct INSERT/UPDATE of `status`/`current_stage`** by ordinary users.
2. Move every transition to **`SECURITY DEFINER` RPCs** (`submit_budget`, `approve_request`, `reject_request`, `allocate_rd_cap`) that: re-derive the next stage server-side, check the caller's role/scope, enforce raiser≠approver, append to an **append-only** `request_events` audit table, and use `select … for update` for atomicity.
3. In `auth.ts`, call `supabase.auth.signOut()` on every non-allowed branch (pending/disabled), and **turn email confirmation back on**, so an unapproved account never holds a session (fixes C4).

**Tier 2 — integrity:**
4. Stop `replaceAll`; per-row writes only (fixes C3 + perf #1).
5. Enforce business rules in the RPC: 80%-of-client-order cap, R&D cap, 20% margin, amount = amount×fxRate.
6. DB constraints: partial unique index for one active budget per `projectId`; numeric `check (amount_inr >= 0)`; trigger to make `Active`/`Rejected` budgets immutable.

**Tier 3 — privacy/perf:**
7. Attachments → Storage with per-object policies + signed URLs.
8. Scoped `select` with explicit columns + server-side filters.

**Tier 4 — correctness:**
9. Fix M1 (count distinct approver ids, not a string), M2 (pick one month field), M3 (random/uuid ids), L1 (`amountINR ?? amount`).

---

## 8. One-line takeaway

The budget workflow is well-designed **as a UI**, but the database is configured as a shared notebook any employee can rewrite. Until authorization and the state machine move into Postgres (RLS + `SECURITY DEFINER` RPCs), approvals, rejections, caps, and the audit trail are all advisory — and the whole company's financial data is readable by every logged-in user.
</content>
</invoke>
