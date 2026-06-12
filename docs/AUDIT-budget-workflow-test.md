# Budget Allocation Workflow — Full Test Report

**Date:** 2026-06-12
**Scope:** The budget allocation flow only — raising a budget (Project / Monthly /
Extension / R&D), the multi-stage approval chain that drives it to Active, and the
visibility/act-permission rules at every stage — for **every user in every
department**, including the special-scope users, at amounts **below ₹1L, at the ₹1L
boundary, between ₹1L–5L, at the ₹5L boundary, and above ₹5L**.
**Method:** A harness (`scripts/test-budget-workflow.ts`) that imports the **real**
production modules (`workflow.ts`, `access.ts`, `roster.ts`, `constants.ts`) and
replays the exact logic of `NewBudgetRequestForm.submit()` and
`ActionButtons.doAction("approve")`. It drives each request through the chain and, at
every stage, snapshots **who can act** (`canUserActOnRequest`) and **who can see**
(`canUserSeeRequest`), flagging self-approval, blind approvers, cross-department
reach, stuck requests and form-gate bypasses.
**Full machine log:** `docs/budget-workflow-test.log` (1,507 lines — every trace and
the full matrix). `npx tsc --noEmit` = clean.

> **One caveat up front:** every rule in this flow is enforced **client-side only**.
> The Supabase RLS on the `budgets` table is `using(true) with check(true)` (see
> `schema.sql:194`), so every "BLOCKED" and every approval gate below is a guard in
> the browser, not in the database. A user who bypasses the UI (devtools, direct
> Supabase call) is subject to **none** of it. This was already noted in
> `AUDIT-budget-allocation.md`; this report assumes the UI is the only path and
> audits the *logic* within it.

---

## ✅ POST-FIX ADDENDUM (2026-06-12, same day)

Fixes 1–7 from §6 were applied and the harness re-run. **46 issues → 3.**
`docs/budget-workflow-test.log` now reflects the **post-fix** run (the findings below
describe the pre-fix state and are kept as the record of what was found and why each
guard now exists).

| Fix | Where |
|-----|-------|
| Self-approval blocked at every stage (`requesterId === user.id`) | `access.ts` `canUserActOnRequest` |
| Requester stripped from `selectedApprovers`; sole-head raise escalates to the next chain authority instead of being stuck | `NewBudgetRequestForm.tsx` |
| Sales budgets route to the ODM-SALES (Sales) head, not the ODM heads; visibility matched | `workflow.ts`, `access.ts` |
| Extension dropdown + `submit()` restricted to the requester's own department's projects | `NewBudgetRequestForm.tsx` |
| Monthly / Extension / Project role gates enforced in `submit()` (not just disabled buttons) | `NewBudgetRequestForm.tsx` |
| Submission blocked when no approver is configured ("Other" / Executive-employee) | `NewBudgetRequestForm.tsx` |
| ≥₹5L budgets now route Dept → **VP → CEO** → FinanceHead, matching the FlowPreview (which now shows VP and CEO as separate steps); payments/POs untouched | `workflow.ts` |
| Budgets stamp `isProject`, and approvers are computed with the same flag, so the ODM-PROJECT head can SEE everything they must approve | `NewBudgetRequestForm.tsx` |

**Remaining (accepted/known):**
- `SM_OVERRIDE_SKIPS_ALL` (MEDIUM, by design): one SuperManager still takes any budget straight to Active with no countersign — policy decision pending (§4). Enforced identically server-side (the override is an allowed transition, not a hole).
- `BLIND_APPROVER` + `TAB_LOCKED_APPROVER` for the multi-dept head `U-MULTI` only: they can act on Product requests only from the Product tab, and primary-tab visibility hides them — tab-UX asymmetry, not a leak (§4).

### Server-side enforcement landed (migration 0011) — the §6 item 8 caveat is now CLOSED

The browser guards above are now **also enforced in Postgres** for the `budgets`
table, so an API-level caller bypassing the UI is bound by the same workflow.

- **`supabase/migrations/0011_budget_workflow_rls.sql`** (also merged into
  `supabase/schema.sql`): replaces the permissive `budgets using(true)/check(true)`
  policy with (a) a `budgets_guard` AFTER INSERT/UPDATE/DELETE trigger that mirrors
  `getEligibleDeptApprovers` / `computeNextStage` / `canUserActOnRequest` and the
  `submit()` raise gates — forged `requesterId`, self-approval, hand-picked approver
  lists, stage skips, mid-approval amount tampering, forged history attribution,
  cross-department extensions, the 80% and R&D caps, and born-Active/born-stuck
  requests are all rejected in the database; (b) a scoped `budgets_select` policy
  (company-wide finance/exec roles see all, others see their own departments +
  their own requests + sanctioned ODM/Sales bridge); (c) a `budgets_delete` policy
  limiting deletes to SuperManagers on R&D-cap config rows. Service-role/seed
  sessions (`auth.uid() is null`) and the `Admin` console role bypass the trigger.
- **`src/lib/db.ts` + `src/App.tsx`**: budget saves switched from
  replace-the-whole-collection to a **diff-based save** (`saveBudgetsDiff`) that
  writes only the rows this action changed and surfaces a server rejection as a
  toast + state re-sync. The old model re-upserted every row on each save, which
  would trip the trigger on other users' in-flight rows.
- **Verified** by `scripts/test-budget-rls.sql` (run via `bash scripts/test-budget-rls.sh`):
  boots a throwaway `postgres:16` with a Supabase auth stub, applies the real
  `schema.sql`, and runs **21 raw-SQL attacks (all blocked) + 25 legitimate flows
  (all allowed)** as authenticated sessions — i.e. exactly what a UI-bypassing
  caller can attempt. All pass.

**Out of scope of 0011 (still client-side only):** the `requests` (payments) and
`pos` tables keep `using(true)/check(true)`. The same trigger pattern should be
extended to them next; this migration covers the budget flow that was audited.

Policy consequence (unchanged): the Finance Head (role `FinanceHead`, not a
`DeptApprover`) can no longer raise Monthly budgets — enforced on both sides now.
If Finance needs Monthly budgets, configure a Finance `DeptApprover`.

---

## 0. Test coverage

```
Roster ........ 27 users across 9 departments + 1 no-dept + 1 read-only
Amount tiers .. ₹0.5L (<1L), ₹1L (=VP), ₹2.5L (1L–5L), ₹5L (=CEO), ₹7.5L (>5L)
Budget types .. Project (Client + R&D), Monthly, Extension
Detailed traces 14 representative users × 5 tiers, stage-by-stage
Full matrix ... 27 users × 3 types × 3 amounts = 243 raise attempts
Result ........ 46 distinct issues, 4 control checks PASSED
```

The four controls that **work correctly**: rejected requests are terminal; an
approver cannot approve the same request twice (consensus can't be satisfied by one
person); read-only and no-dept accounts cannot raise or act; the R&D monthly cap and
the 80% client-order cap both block over-limit requests (client-side).

---

## 1. Verdict by tier — does the chain route correctly?

For a normal department employee raising a **Client Project** budget, routing is
correct at every tier:

| Tier | Amount | Path observed | Correct? |
|------|--------|---------------|----------|
| < ₹1L | ₹0.5L | Dept → FinanceHead → Active | ✅ |
| = ₹1L | ₹1L | Dept → VP → FinanceHead → Active | ✅ |
| ₹1L–5L | ₹2.5L | Dept → VP → FinanceHead → Active | ✅ |
| = ₹5L | ₹5L | Dept → **CEO** → FinanceHead → Active | ⚠️ see §3.6 |
| > ₹5L | ₹7.5L | Dept → **CEO** → FinanceHead → Active | ⚠️ see §3.6 |

The threshold arithmetic itself is right (₹1L hits the VP tier, ₹5L hits the CEO
tier — the `>=` boundaries are correct). The Box Build pre-stage works: a Box Build
**Project Manager / Vendor Manager** correctly gets an extra `BoxBuildMid` (Delivery
Head) stage before the dept head; a regular Box Build employee does not.

**But the flow is only correct for the "happy path" user.** The moment you test
every *other* user and department, the problems below appear.

---

## 2. CRITICAL findings

### 2.1 Every department head can approve their own budget (no segregation of duties)
**Code:** `SELF_APPROVAL` · 22 occurrences across all 7 department-head users.

A `DeptApprover` is placed in their own request's `selectedApprovers` list, and
`canUserActOnRequest` only blocks a *second* approval by the same person — never the
**first** one by the requester. So every head can raise **and single-handedly
approve** their own Monthly/Project/Extension budget at the `DeptApproval` stage.

Worst case observed — **the Finance Head (`U-FH`) raising a Monthly budget approves
it at TWO stages of its own chain**:

```
U-FH/Monthly/₹0.5L:
  DeptApproval  → U-FH approves (it's their dept)      → FinanceHead
  FinanceHead   → U-FH approves again (they ARE the FH) → ACTIVE
  PATH: DeptApproval(U-FH) → FinanceHead(U-FH) → ACTIVE
```

A sub-₹1L budget raised by the Finance Head reaches **Active with the requester as
the only approver at both gates.** For amounts under ₹1L (no VP/CEO in the chain),
*any* department head's self-raised budget goes Active with zero independent review.

**Fix:** in `canUserActOnRequest`, reject when `request.requesterId === user.id` at
every approval stage (and ideally drop the requester from `selectedApprovers` at
raise time in `NewBudgetRequestForm`).

---

## 3. HIGH findings

### 3.1 "Blind approvers" — can act on requests they cannot see
**Code:** `BLIND_APPROVER` · 8 distinct head/dept combinations.

`canUserActOnRequest` and `canUserSeeRequest` disagree. The clearest case is
**`U-ODM-PROJ`** (scope `ODM-PROJECT`):

- `canUserSeeRequest` → `headSeesRequest` requires `request.isProject === true`, but
  budget records **never set an `isProject` field** (only POs/payments do). So an
  ODM-PROJECT head sees **no budgets at all** in any list view.
- `canUserActOnRequest` → at `DeptApproval` it only checks
  `selectedApprovers.includes(user.id)`, which the form populated for them.

Net: the ODM-PROJECT head is a **required approver on a 2-person ODM consensus**
(`selectedApprovers=[U-ODM-ALL, U-ODM-PROJ]` on every ODM project budget) yet the
request **never appears in any of their visibility-filtered views**. The Dashboard
inbox is built from `canUserActOnRequest` alone (`Dashboard.tsx:32`), so it *does*
surface there — meaning the same request is simultaneously actionable and invisible
depending on which screen they open. Same pattern hits `U-ODM-ALL` and
`U-SALES-HEAD` on Sales project budgets, and the multi-dept head `U-MULTI` on
Product. **A budget can stall because its required approver can't find it except in
one tab.**

### 3.2 ODM heads can act on Sales budgets they have no mandate over
**Code:** `CROSS_DEPT_ACT` · `U-ODM-ALL`, `U-ODM-PROJ` on Sales.

A Sales employee's project budget gets `selectedApprovers=[U-ODM-ALL, U-ODM-PROJ]`
because `getEligibleDeptApprovers` routes **all** Sales work to ODM heads
(`workflow.ts:42-44` lumps ODM and Sales together for the ODM-ALL/ODM-PROJECT
scopes). The intended bridge is **only** `U-SALES-HEAD` (scope `ODM-SALES`), and only
for requesters who themselves carry the `ODM-SALES` scope (`workflow.ts:38`). But a
plain Sales employee with no scope falls through to lines 42-44 and is routed to the
**ODM** heads instead of the Sales head. Observed:

```
U-SALES-E/Project/₹0.5L:
  raised: selectedApprovers=[U-ODM-ALL, U-ODM-PROJ]   ← Sales req, ODM approvers
  canACT at DeptApproval: U-SM1, U-SM2, U-ODM-ALL, U-ODM-PROJ
```

The actual Sales head (`U-SALES-HEAD`) is **not** in the approver list for their own
department's employee, while two ODM heads are. This is both a routing bug and a
cross-department authority leak.

### 3.3 Extensions ignore department entirely — cross-dept budget injection
**Code:** `CROSS_DEPT_EXTENSION` · HR, Product, Marketing heads onto an ODM project.

The Extension dropdown (`NewBudgetRequestForm.tsx:292`) lists **every** active
project in the company with no department filter, and `submit()` never checks that
the parent project belongs to the requester's department. So **any** head can raise
an Extension against **any** department's project. The extension record is stamped
with the *requester's* `dept`, so it then routes to the **requester's own**
approvers — the project's real department heads never see it:

```
U-HR-HEAD raises Extension on PRJ-ODM-1 (an ODM project)
  → extension.dept = "HR"
  → routes to HR's approver (U-HR-HEAD — i.e. themselves, see §2.1)
  → ODM heads never involved; the 80% cap is checked against the ODM parent
    but approval authority is entirely HR's
```

An HR head can inflate an ODM project's committed budget and self-approve the
extension. **Fix:** filter the dropdown to the user's own department (or the
project's dept), and validate `parent.dept === user.dept` in `submit()`.

### 3.4 Monthly-budget role gate is bypassable for non-project departments
**Code:** `GATE_BYPASS_MONTHLY` · 6 users: HR/Product/Marketing/Finance employees,
**plus the Finance Head and the Accountant.**

`canRaiseMonthly = isHODLevel(user)` only disables the *button*. But for the four
`NON_PROJECT_DEPTS` (HR, Finance, Product, Marketing) the form **opens** with
`budgetType` already set to `"Monthly"` (`NewBudgetRequestForm.tsx:14`), and
`submit()` has **no role check for Monthly** — only Project and R&D get
authorization checks. So an ordinary HR/Finance/Product/Marketing employee lands on
a pre-selected Monthly form and submits successfully, despite the UI claiming "Only
Department Heads can raise Monthly Budgets."

```
U-HR-E (Employee) → Monthly ₹0.5L → submits → routes to HR head → Active
U-FIN-E (Employee) → Monthly → submits → routes to FinanceHead
```

**Fix:** add `if (budgetType === "Monthly" && !isHODLevel(user)) return setErr(...)`
to `submit()`.

### 3.5 "Other" and "Executive"-employee budgets are born stuck
**Code:** `NO_APPROVER_AT_RAISE` + `STUCK_NO_APPROVER` · `U-OTH-E`, `U-EXEC-E`.

`getEligibleDeptApprovers` has no branch for the **"Other"** department, and for
**Executive** it returns `[]` for a plain `Employee` (only CEO/VP roles have a chain
there). The form does **not** check that at least one approver exists, so the request
is created with `selectedApprovers=[]` and `currentStage="DeptApproval"` — **stuck
forever** unless a SuperManager happens to override it. No error is shown to the
requester; the budget simply sits in limbo.

```
U-OTH-E/Project → selectedApprovers=[] → STUCK at DeptApproval
U-EXEC-E/Project → selectedApprovers=[] → STUCK at DeptApproval
```

**Fix:** block submission when `eligibleApprovers.length === 0` (unless a Box Build
mid-stage applies), with a clear "no approver configured for your department" error.

### 3.6 ≥ ₹5L budgets skip the VP — contradicts the form's own preview
**Code:** `VP_SKIPPED_AT_5L` (listed MEDIUM, but worth noting here).

`computeNextStage` checks `>= CEO_THRESHOLD` **before** `>= VP_THRESHOLD`
(`workflow.ts:75-76`), so a ≥₹5L budget goes **DeptApproval → CEO → FinanceHead** and
the **VP never reviews it**. But the form's `FlowPreview` advertises
**"VP + CEO"** for this tier (`NewBudgetRequestForm.tsx:303`). Either the preview is
wrong or the routing is — the two disagree for every budget at or above ₹5L. (POs, by
contrast, *do* route VP-then-SuperManager for ≥₹5L — so budgets are inconsistent with
POs too.) Decide the intended policy and align both.

---

## 4. MEDIUM / LOW findings

- **`SM_OVERRIDE_SKIPS_ALL` (MEDIUM):** any single SuperManager approval at any early
  stage sends a budget **straight to Active**, skipping VP, CEO and Finance Head — at
  *any* amount (₹50L included). It's labelled "special access" by design, but unlike
  the PO flow (which has a dedicated dual SuperManager stage), budgets get **no second
  countersign**. One SuperManager = full bypass of every financial control.
- **`CROSS_DEPT_SEE` (MEDIUM):** none found beyond the sanctioned company-wide roles
  (CEO/VP/Finance/Accountant/SuperManager see everything by design) — so ordinary
  cross-department *visibility* is clean. The leaks are on the **act** side (§3.1–3.3).
- **`TAB_LOCKED_APPROVER` (LOW):** the multi-dept head `U-MULTI` (Marketing +Product)
  can only act on Product requests after switching their dashboard tab to Product;
  on their default Marketing tab `canUserActOnRequest` returns false even though they
  are the routed approver. Cosmetic/routing-UX, not a leak — the action badge does
  count it.

---

## 5. Data-leak summary

| Question | Answer |
|----------|--------|
| Can a user **see** another department's budget without authorization? | **No** — visibility is correctly limited to the requester, the sanctioned scopes, and the company-wide finance/exec roles. |
| Can a user **act on** another department's budget without authorization? | **Yes** — ODM heads on Sales budgets (§3.2); any head can inject + self-approve an Extension on another dept's project (§3.3). |
| Can a user approve **their own** budget? | **Yes** — every dept head, and the Finance Head at two stages (§2.1). |
| Can a request reach **Active** with no independent review? | **Yes** — a head's own sub-₹1L budget, or any budget via a single SuperManager override (§2.1, §4). |
| Can a request get **stuck/lost**? | **Yes** — "Other"/Executive-employee budgets, and any budget whose required approver can't see it (§3.5, §3.1). |
| Can a **non-authorized user raise** a restricted budget type? | **Yes** — Monthly budgets by any non-project-dept employee (§3.4). |
| Are read-only / no-dept accounts contained? | **Yes** — correctly blocked from raising and acting. |

---

## 6. Recommended fix priority

1. **Block self-approval** in `canUserActOnRequest` (`requesterId === user.id`) — and
   strip the requester from `selectedApprovers` at raise. *(CRITICAL, one-line guard.)*
2. **Fix Sales routing** so a scope-less Sales employee routes to `U-SALES-HEAD`, not
   the ODM heads (`workflow.ts:42`). *(HIGH)*
3. **Scope the Extension dropdown** to the requester's department and validate parent
   dept in `submit()`. *(HIGH)*
4. **Add the Monthly role check** to `submit()`. *(HIGH)*
5. **Block submission when no approver exists**; surface an error. *(HIGH)*
6. **Reconcile the ≥₹5L VP-vs-CEO chain** with the FlowPreview, and decide whether
   budgets need a SuperManager countersign like POs do. *(MEDIUM)*
7. Make budget `isProject` populate (or drop it from `headSeesRequest`) so ODM-PROJECT
   heads can *see* what they're required to approve. *(HIGH — fixes the blind-approver
   split.)*
8. **Move enforcement server-side.** Every item above is a browser guard today; the
   RLS `using(true)/check(true)` means none of it binds an API-level caller.

---

*Harness: `scripts/test-budget-workflow.ts` · full log: `docs/budget-workflow-test.log`.
Re-run with `npx tsx scripts/test-budget-workflow.ts`.*
