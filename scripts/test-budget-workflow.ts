// Budget-allocation workflow test harness.
//
// Imports the REAL production modules (workflow.ts / access.ts / roster.ts /
// constants.ts) and simulates, for every user in every department:
//   raise (mirroring NewBudgetRequestForm.submit) -> stage-by-stage approval
//   (mirroring ActionButtons.doAction) -> terminal state,
// at amounts below 1L, at the 1L boundary, between 1L and 5L, at the 5L
// boundary, and above 5L. At every stage it snapshots WHO CAN ACT and WHO CAN
// SEE the request and flags self-approval, blind approvers (can act but cannot
// see), cross-department actors, stuck requests, and form-gate bypasses.
//
// Run: npx tsx scripts/test-budget-workflow.ts

import { VP_THRESHOLD, CEO_THRESHOLD, MAX_BUDGET_RATIO, NON_PROJECT_DEPTS } from "../src/constants";
// (effectiveDepts is imported from access below — used by the Extension dept gate.)
import { setRoster } from "../src/lib/roster";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, computeNextStage, getStageLabel, getDeptHeadsForDept } from "../src/lib/workflow";
import { canUserSeeRequest, canUserActOnRequest, effectiveDepts, isHODLevel, isReadOnly } from "../src/lib/access";

// ---------------------------------------------------------------- roster
const R = (id: string, name: string, designation: string, dept: string, role: string, scope?: string, extraDepts?: string[]) =>
  ({ id, name, designation, dept, role, scope, extraDepts, active: true });

const ROSTER = [
  R("U-CEO",        "Cara Ceo",        "Chief Executive Officer",        "Executive",  "CEO"),
  R("U-VP",         "Vikram Vp",       "Vice President",                 "Executive",  "VP"),
  R("U-EXEC-E",     "Esha ExecAsst",   "Executive Assistant",            "Executive",  "Employee"),
  R("U-SM1",        "Stuti Sm",        "Manager (Special Access)",       "Management", "SuperManager"),
  R("U-SM2",        "Sarthak Sm",      "Manager (Special Access)",       "Management", "SuperManager"),
  R("U-FH",         "Fiona FinHead",   "Finance Head",                   "Finance",    "FinanceHead"),
  R("U-ACC",        "Arya Accountant", "Accountant",                     "Finance",    "Accountant"),
  R("U-FIN-E",      "Felix FinEmp",    "Finance Executive",              "Finance",    "Employee"),
  R("U-HR-HEAD",    "Hema HrHead",     "HR Head",                        "HR",         "DeptApprover", "HR"),
  R("U-HR-E",       "Hari HrEmp",      "HR Executive",                   "HR",         "Employee"),
  R("U-ODM-ALL",    "Omar OdmHead",    "ODM Head (all ODM)",             "ODM",        "DeptApprover", "ODM-ALL"),
  R("U-ODM-PROJ",   "Pia OdmProjHead", "ODM Project Head",               "ODM",        "DeptApprover", "ODM-PROJECT"),
  R("U-ODM-E",      "Eron OdmEmp",     "ODM Engineer",                   "ODM",        "Employee"),
  R("U-SALES-HEAD", "Sana SalesHead",  "Sales Head (ODM-SALES bridge)",  "Sales",      "DeptApprover", "ODM-SALES"),
  R("U-SALES-E",    "Sam SalesEmp",    "Sales Executive",                "Sales",      "Employee"),
  R("U-SALES-BR",   "Bea SalesBridge", "Sales Exec (ODM-SALES scope)",   "Sales",      "Employee",     "ODM-SALES"),
  R("U-BB-HEAD",    "Bala BbHead",     "Box Build Head",                 "Box Build",  "DeptApprover", "BOXBUILD"),
  R("U-BB-MID",     "Arun Delivery",   "Delivery Head",                  "Box Build",  "BoxBuildMidApprover"),
  R("U-BB-E",       "Banu BbEmp",      "Box Build Technician",           "Box Build",  "Employee"),
  R("U-BB-PM",      "Prem BbPm",       "Project Manager",                "Box Build",  "Employee"),
  R("U-PROD-HEAD",  "Prachi ProdHead", "Product Head",                   "Product",    "DeptApprover"),
  R("U-PROD-E",     "Pranav ProdEmp",  "Product Analyst",                "Product",    "Employee"),
  R("U-MULTI",      "Mira MultiHead",  "Marketing Head (+Product)",      "Marketing",  "DeptApprover", undefined, ["Product"]),
  R("U-MKT-E",      "Manu MktEmp",     "Marketing Executive",            "Marketing",  "Employee"),
  R("U-OTH-E",      "Omi OtherEmp",    "Generalist",                     "Other",      "Employee"),
  R("U-RO",         "Rhea ReadOnly",   "Analyst (Read-only)",            "HR",         "EmployeeReadOnly"),
  R("U-NODEPT",     "Nimit NoDept",    "Contractor",                     "",           "Employee"),
];
setRoster(ROSTER);
const byId = (id: string) => ROSTER.find(u => u.id === id)!;

// ---------------------------------------------------------------- helpers
let CLOCK = 0;
const ts = () => new Date(1765400000000 + (CLOCK += 60000)).toISOString();
const MONTH = ts().slice(0, 7);
const L = (n: number) => "₹" + (n / 100000).toFixed(n % 100000 ? 2 : 0) + "L";

type Finding = { code: string; sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS"; msg: string; scenario: string };
const FINDINGS: Finding[] = [];
const seenFindingKeys = new Set<string>();
function flag(code: Finding["code"], sev: Finding["sev"], scenario: string, msg: string, dedupe = true) {
  const key = code + "|" + msg;
  if (dedupe && seenFindingKeys.has(key)) return;
  seenFindingKeys.add(key);
  FINDINGS.push({ code, sev, msg, scenario });
}

const LOG: string[] = [];
function log(s = "") { LOG.push(s); console.log(s); }

// Scopes whose cross-department reach is sanctioned by the chain of command.
const SANCTIONED: Record<string, string[]> = {
  "ODM-ALL": ["ODM"], "ODM-PROJECT": ["ODM"], "ODM-SALES": ["ODM", "Sales"],
  "HR": ["HR"], "BOXBUILD": ["Box Build"],
};
const COMPANY_WIDE_ROLES = ["CEO", "VP", "FinanceHead", "Accountant", "SuperManager"];

function deptSanctionedFor(u: any, dept: string) {
  if (COMPANY_WIDE_ROLES.includes(u.role)) return true;
  if (u.scope && SANCTIONED[u.scope]) return SANCTIONED[u.scope].includes(dept);
  return effectiveDepts(u).includes(dept);
}
// A multi-department head can switch dashboard tabs; acting is possible if ANY tab allows it.
const actOnAnyTab = (u: any, req: any) =>
  canUserActOnRequest(u, req) || effectiveDepts(u).some(d => d !== u.dept && canUserActOnRequest({ ...u, dept: d }, req));

// ---------------------------------------------------------------- fixtures
// One Active client project per project department (for Extensions), and an
// Active R&D cap allocation of 2L for ODM this month (as a SuperManager would set).
function fixtures() {
  const mk = (dept: string, pid: string) => ({
    id: "BUD-FIX-" + pid, kind: "Budget", type: "Project", projectType: "Client",
    projectId: pid, projectName: pid + " Fixture", dept, requesterId: "U-SM1", requesterName: "Stuti Sm",
    clientOrderValue: 2000000, amountINR: 1000000, amount: 1000000, currency: "INR", fxRate: 1,
    currentStage: "Active", status: "Active", createdDate: ts(), history: [],
  });
  return [
    mk("ODM", "PRJ-ODM-1"), mk("Box Build", "PRJ-BB-1"), mk("Sales", "PRJ-SALES-1"), mk("Other", "PRJ-OTH-1"),
    { id: "RDCAP-ODM", kind: "Budget", type: "RDCap", dept: "ODM", month: MONTH, amountINR: 200000, status: "Active", currentStage: "Active", history: [] },
  ];
}

// ---------------------------------------------------------------- raise (mirrors NewBudgetRequestForm.submit)
let SEQ = 0;
function raise(user: any, budgetType: string, amountINR: number, budgets: any[], opts: any = {}) {
  const scen = opts.scenario || `${user.id}/${budgetType}/${L(amountINR)}`;
  // submit() guards, in the form's order
  if (isReadOnly(user)) return { blocked: "submit(): read-only account cannot raise requests" };
  if (!user.dept) return { blocked: "submit(): no department assigned" };

  // Role gates — submit() now enforces these server-side-of-the-form, not just via
  // disabled buttons (the Monthly gate used to be bypassable because non-project
  // depts open the form with budgetType="Monthly").
  const canRaiseProject = !NON_PROJECT_DEPTS.includes(user.dept) && (user.role === "Employee" || isHODLevel(user) || user.role === "DeptApprover");
  const canRaiseMonthly = isHODLevel(user);
  const canRaiseExtension = isHODLevel(user);
  const canRaiseRD = user.dept === "ODM" && (user.role === "Employee" || isHODLevel(user));
  if (budgetType === "Monthly" && !canRaiseMonthly) return { blocked: "submit(): only Department Heads can raise Monthly Budgets" };
  if (budgetType === "Extension" && !canRaiseExtension) return { blocked: "submit(): only Department Heads can raise Extensions" };
  if (budgetType === "Project" && !canRaiseProject) return { blocked: "submit(): department/role cannot raise Project budgets" };

  // The form computes approvers with isProject = (budgetType !== "Monthly") and stamps
  // the same flag on the record, so act-routing and visibility stay consistent.
  const isProjectBudget = budgetType !== "Monthly";
  const eligible = getEligibleDeptApprovers(user, { requiresProject: true, category: "Project" }, isProjectBudget);
  // submit() refuses to create a request that would be born stuck with no approver.
  if (eligible.length === 0) return { blocked: "submit(): no approver configured for this department" };

  if (budgetType === "Project") {
    const projectType = opts.projectType || "Client";
    if (projectType === "Client") {
      const order = opts.clientOrderINR ?? amountINR * 2;
      if (amountINR > order * MAX_BUDGET_RATIO) return { blocked: `submit(): exceeds 80% of client order (max ${L(order * MAX_BUDGET_RATIO)})` };
    } else { // RD — submit() enforces these
      if (!canRaiseRD) return { blocked: "submit(): only ODM can raise R&D budgets" };
      const alloc = budgets.find(b => b.type === "RDCap" && b.dept === user.dept && b.month === MONTH && (b.status === "Active" || b.currentStage === "Active"));
      if (!alloc) return { blocked: "submit(): no R&D allocation for this dept+month (RDCapRequest path)" };
      const used = budgets.filter(b => b.type === "Project" && b.projectType === "RD" && b.dept === user.dept && (b.status === "Active" || b.currentStage === "Active") && (b.createdDate || "").slice(0, 7) === MONTH).reduce((s, b) => s + b.amountINR, 0);
      if (amountINR > Math.max(0, alloc.amountINR - used)) return { blocked: `submit(): exceeds R&D allocation (avail ${L(Math.max(0, alloc.amountINR - used))})` };
    }
  } else if (budgetType === "Extension") {
    const parent = budgets.find(b => b.projectId === opts.extensionFor && b.type === "Project");
    if (!parent) return { blocked: "submit(): no such project to extend" };
    // The dropdown is now filtered to the requester's departments AND submit()
    // validates the parent's dept, closing the cross-dept extension injection.
    if (!effectiveDepts(user).includes(parent.dept)) {
      return { blocked: `submit(): cannot extend a ${parent.dept} project from ${user.dept} (own-department projects only)` };
    }
    if (parent.projectType === "Client") {
      const extTotal = budgets.filter(b => b.type === "Extension" && b.extensionFor === opts.extensionFor && (b.status === "Active" || b.currentStage === "Active")).reduce((s, e) => s + e.amountINR, 0);
      if (parent.amountINR + extTotal + amountINR > parent.clientOrderValue * MAX_BUDGET_RATIO) return { blocked: "submit(): extension exceeds combined 80% cap" };
    }
  }

  const needsMid = needsBoxBuildMidApproval(user);
  // Mirrors the fixed form: drop the raiser from the approver set; if that empties it,
  // escalate to the next authority instead of routing to (impossible) self-approval.
  const approverIds = eligible.map((a: any) => a.id).filter((id: string) => id !== user.id);
  const needsMidStage = needsMid && user.dept === "Box Build" && user.role === "Employee";
  const initialStage = needsMidStage
    ? "BoxBuildMid"
    : (approverIds.length === 0 ? computeNextStage({ kind: "Budget", amountINR, type: budgetType }, "DeptApproval", null) : "DeptApproval");

  const req: any = {
    id: `BUD-${++SEQ}`, kind: "Budget", type: budgetType,
    projectType: budgetType === "Project" ? (opts.projectType || "Client") : undefined,
    isProject: isProjectBudget,
    createdDate: ts(), requesterId: user.id, requesterName: user.name, dept: user.dept,
    projectId: opts.projectId || (budgetType === "Project" ? `PRJ-${SEQ}` : ""),
    clientOrderValue: (budgetType === "Project" && (opts.projectType || "Client") === "Client") ? (opts.clientOrderINR ?? amountINR * 2) : 0,
    amount: amountINR, currency: "INR", fxRate: 1, amountINR,
    extensionFor: opts.extensionFor || "", scope: opts.scopeText || "as per attached SOW", month: MONTH,
    selectedApprovers: approverIds,
    currentStage: initialStage, status: getStageLabel(initialStage, "Budget"),
    history: [{ action: "Submitted", by: user.name, byId: user.id, at: ts(), comments: `${budgetType} budget request raised` }],
  };
  if (req.selectedApprovers.length === 0 && initialStage === "DeptApproval") {
    flag("NO_APPROVER_AT_RAISE", "HIGH", scen,
      `${user.id} (${user.role}, dept=${user.dept || "—"}) submits a budget with selectedApprovers=[] — the form never checks that an approver exists; the request is born stuck at DeptApproval (only a SuperManager override can move it).`);
  }
  return { req };
}

// ---------------------------------------------------------------- approve (mirrors ActionButtons.doAction("approve") for Budget)
function approveBudget(req: any, user: any) {
  const now = ts();
  let newStage = req.currentStage, newStatus = req.status, actionLabel: string;
  const isEarly = !["FinanceHead", "Accountant", "Processing"].includes(req.currentStage);
  if (user.role === "SuperManager" && isEarly) {
    actionLabel = `Approved by ${user.name}`; newStage = "Active"; newStatus = "Active";
  } else {
    actionLabel = ({ BoxBuildMid: "Approved by Delivery Head", DeptApproval: "Approved (Dept)", VP: "Approved by VP", CEO: "Approved by CEO", FinanceHead: "Approved by Finance Head" } as any)[req.currentStage] || "Approved";
    if (req.currentStage === "DeptApproval" && req.selectedApprovers && req.selectedApprovers.length > 1) {
      const got = req.history.filter((h: any) => h.action === "Approved (Dept)").length + 1;
      if (got < req.selectedApprovers.length) {
        newStage = "DeptApproval"; newStatus = getStageLabel("DeptApproval", "Budget") + ` (${got}/${req.selectedApprovers.length})`;
      } else {
        newStage = computeNextStage({ ...req, kind: "Budget" }, "DeptApproval", user);
        newStatus = newStage === "Active" ? "Active" : getStageLabel(newStage, "Budget");
      }
    } else {
      newStage = computeNextStage({ ...req, kind: "Budget" }, req.currentStage, user);
      newStatus = newStage === "Active" ? "Active" : getStageLabel(newStage, "Budget");
    }
  }
  const out = { ...req, currentStage: newStage, status: newStatus, history: [...req.history, { action: actionLabel, by: user.name, byId: user.id, at: now, comments: "" }] };
  if (newStage === "Active" && !out.approvedBy) { out.approvedBy = user.name; out.approvedDate = now; }
  return out;
}

// ---------------------------------------------------------------- stage audit
function auditStage(req: any, scen: string, verbose: boolean) {
  const actors = ROSTER.filter(u => actOnAnyTab(u, req));
  const seers = ROSTER.filter(u => canUserSeeRequest(u, req));
  if (verbose) {
    log(`    stage=${req.currentStage.padEnd(13)} status="${req.status}"`);
    log(`      canACT: ${actors.map(u => u.id + (canUserActOnRequest(u, req) ? "" : "*tab")).join(", ") || "(nobody)"}`);
    log(`      canSEE: ${seers.map(u => u.id).join(", ") || "(nobody)"}`);
  }
  for (const u of actors) {
    if (u.id === req.requesterId)
      flag("SELF_APPROVAL", "CRITICAL", scen, `${u.id} (${u.role}, ${u.dept}) can approve their OWN ${req.type} budget at stage ${req.currentStage} — no segregation of duties (raiser == approver).`);
    if (!canUserSeeRequest(u, req) && u.role !== "SuperManager")
      flag("BLIND_APPROVER", "HIGH", scen, `${u.id} (${u.role}, scope=${u.scope || "—"}) CAN ACT on a ${req.dept} ${req.type} budget at ${req.currentStage} but canUserSeeRequest()=false — the request appears in their action inbox (Dashboard builds it from canUserActOnRequest alone) while every visibility-filtered view hides it.`);
    if (!deptSanctionedFor(u, req.dept))
      flag("CROSS_DEPT_ACT", "HIGH", scen, `${u.id} (${u.role}, dept=${u.dept}, scope=${u.scope || "—"}) can act on a ${req.dept} request — outside their department and any sanctioned scope.`);
    if (!canUserActOnRequest(u, req) && actOnAnyTab(u, req))
      flag("TAB_LOCKED_APPROVER", "LOW", scen, `${u.id} is a routed approver for ${req.dept} but can only act after switching their dashboard tab to ${req.dept} (canUserActOnRequest is false on their primary tab).`);
  }
  // visibility leak check: anyone who can see but has no sanctioned reason
  for (const u of seers) {
    if (u.id !== req.requesterId && !deptSanctionedFor(u, req.dept))
      flag("CROSS_DEPT_SEE", "MEDIUM", scen, `${u.id} (${u.role}, dept=${u.dept}, scope=${u.scope || "—"}) can SEE a ${req.dept} request without a sanctioned reason.`);
  }
  return { actors, seers };
}

// ---------------------------------------------------------------- chain driver
function runChain(req0: any, scen: string, verbose = false): { path: string[]; final: any; stuck: boolean } {
  let req = req0;
  const path: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (["Active", "Rejected", "Cancelled"].includes(req.currentStage)) break;
    const { actors } = auditStage(req, scen, verbose);
    const nonSM = actors.filter(u => u.role !== "SuperManager");
    let actor: any;
    if (req.currentStage === "DeptApproval") {
      for (const id of req.selectedApprovers || []) { const u = nonSM.find(c => c.id === id); if (u) { actor = u; break; } }
      actor = actor || nonSM[0];
    } else {
      const want = ({ BoxBuildMid: "BoxBuildMidApprover", VP: "VP", CEO: "CEO", FinanceHead: "FinanceHead" } as any)[req.currentStage];
      actor = nonSM.find(u => u.role === want) || nonSM[0];
    }
    if (!actor) {
      const smOnly = actors.length > 0;
      flag("STUCK_NO_APPROVER", "HIGH", scen,
        `${req.dept || "(no dept)"} ${req.type} budget by ${req.requesterId} is STUCK at ${req.currentStage}: no eligible approver in the roster${smOnly ? " (only a SuperManager override can move it)" : " (not even a SuperManager — request is dead)"}.`);
      path.push(`${req.currentStage}→STUCK`);
      return { path, final: req, stuck: true };
    }
    const before = req.currentStage;
    req = approveBudget(req, actor);
    path.push(`${before}(${actor.id})`);
    if (verbose) log(`      -> ${actor.id} approves: ${before} → ${req.currentStage}`);
  }
  path.push(req.currentStage === "Active" ? "ACTIVE" : req.currentStage);
  return { path, final: req, stuck: false };
}

// expected stage sequence per the rules: <1L Dept→FH, 1L..<5L Dept→VP→FH,
// >=5L Dept→VP→CEO→FH (both VP and CEO review, matching the FlowPreview).
function expectedStages(amountINR: number) {
  if (amountINR >= CEO_THRESHOLD) return ["DeptApproval", "VP", "CEO", "FinanceHead"];
  if (amountINR >= VP_THRESHOLD) return ["DeptApproval", "VP", "FinanceHead"];
  return ["DeptApproval", "FinanceHead"];
}

// ======================================================================
log("=".repeat(100));
log("ELECBITS FINANCE TOOL — BUDGET ALLOCATION WORKFLOW TEST");
log(`Thresholds: VP=${L(VP_THRESHOLD)}  CEO=${L(CEO_THRESHOLD)}  MaxBudgetRatio=${MAX_BUDGET_RATIO}  Month=${MONTH}`);
log(`Roster: ${ROSTER.length} users across ${[...new Set(ROSTER.map(u => u.dept).filter(Boolean))].length} departments`);
log("=".repeat(100));

// ---------------------------------------------------------------- A. detailed traces
log("\n### SECTION A — DETAILED TRACES (special users & boundaries) ###");
const AMOUNTS_DETAIL: [string, number][] = [["below 1L", 50000], ["exactly 1L", 100000], ["1L–5L", 250000], ["exactly 5L", 500000], ["above 5L", 750000]];

const detailCases: any[] = [
  { user: "U-HR-E",     type: "Monthly",  note: "HR employee (gate-bypass candidate)" },
  { user: "U-HR-HEAD",  type: "Monthly",  note: "HR head raises own dept Monthly" },
  { user: "U-ODM-E",    type: "Project",  note: "ODM employee client project" },
  { user: "U-ODM-ALL",  type: "Monthly",  note: "ODM head Monthly (form passes isProject=true)" },
  { user: "U-SALES-E",  type: "Project",  note: "Sales employee — routing check" },
  { user: "U-SALES-BR", type: "Project",  note: "Sales employee with ODM-SALES bridge scope" },
  { user: "U-BB-PM",    type: "Project",  note: "Box Build Project Manager (BoxBuildMid pre-stage)" },
  { user: "U-BB-E",     type: "Project",  note: "Box Build regular employee" },
  { user: "U-PROD-E",   type: "Monthly",  note: "Product employee (multi-dept head consensus)" },
  { user: "U-MKT-E",    type: "Monthly",  note: "Marketing employee (multi-dept head primary)" },
  { user: "U-FIN-E",    type: "Monthly",  note: "Finance employee (FinanceHead double-gate)" },
  { user: "U-FH",       type: "Monthly",  note: "Finance Head raises own Monthly" },
  { user: "U-OTH-E",    type: "Project",  note: "'Other' dept — no head exists" },
  { user: "U-EXEC-E",   type: "Project",  note: "Executive dept employee — no approver branch" },
];

for (const c of detailCases) {
  const u = byId(c.user);
  for (const [tierName, amt] of AMOUNTS_DETAIL) {
    const scen = `${c.user}/${c.type}/${L(amt)}`;
    log(`\n--- ${scen} — ${c.note} [${tierName}] ---`);
    const budgets = fixtures();
    const r = raise(u, c.type, amt, budgets, { scenario: scen, extensionFor: undefined });
    if ("blocked" in r) { log(`    RAISE BLOCKED: ${r.blocked}`); continue; }
    const initialStage = r.req!.currentStage;
    log(`    raised: selectedApprovers=[${r.req!.selectedApprovers.join(", ")}] initialStage=${initialStage}`);
    const { path, final } = runChain(r.req, scen, true);
    log(`    PATH: ${path.join(" → ")}   FINAL: ${final.status}`);
    // compare against the rulebook chain
    const visited = final.history.filter((h: any) => h.action.startsWith("Approved")).length;
    let exp = expectedStages(amt);
    // A sole department head raising their own budget skips the dept stage by design
    // (self-approval ban empties the dept approver list -> escalation): expected chain
    // starts at the escalated initial stage.
    const si = exp.indexOf(initialStage);
    if (si > 0) exp = exp.slice(si);
    const actualStages = path.filter(p => p.includes("(")).map(p => p.split("(")[0]).filter((s, i, a) => a.indexOf(s) === i && s !== "BoxBuildMid");
    if (final.currentStage === "Active") {
      if (amt >= CEO_THRESHOLD && !actualStages.includes("VP"))
        flag("VP_SKIPPED_AT_5L", "MEDIUM", scen, `Budget ≥ ${L(CEO_THRESHOLD)} reached Active without VP review — the FlowPreview promises VP + CEO for this tier.`);
      if (JSON.stringify(actualStages) !== JSON.stringify(exp))
        flag("CHAIN_MISMATCH", "MEDIUM", scen, `Expected ${exp.join("→")} got ${actualStages.join("→")} (approvals: ${visited}).`);
    }
  }
}

// ---------------------------------------------------------------- B. R&D allocation flow (ODM only)
log("\n\n### SECTION B — R&D CAP ALLOCATION FLOW (ODM) ###");
{
  const u = byId("U-ODM-E");
  let budgets = fixtures(); // contains 2L RDCap for ODM
  log("\n--- B1: ODM employee R&D 50k against 2L allocation ---");
  let r = raise(u, "Project", 50000, budgets, { projectType: "RD", scenario: "RD/50k" });
  if ("req" in r) {
    const { path, final } = runChain(r.req, "RD/50k", true);
    log(`    PATH: ${path.join(" → ")}   FINAL: ${final.status}`);
    budgets = [final, ...budgets];
  } else log("    BLOCKED: " + (r as any).blocked);

  log("\n--- B2: second R&D 1.8L — should exceed remaining 1.5L ---");
  r = raise(u, "Project", 180000, budgets, { projectType: "RD", scenario: "RD/180k-over-cap" });
  log("blocked" in r ? `    BLOCKED as expected: ${(r as any).blocked}` : "    !! NOT BLOCKED — cap not enforced");
  if (!("blocked" in r)) flag("RD_CAP_NOT_ENFORCED", "HIGH", "RD/180k", "Second R&D budget exceeding remaining allocation was accepted.");
  else flag("RD_CAP_OK", "PASS", "RD/180k", "R&D monthly cap correctly blocks a request exceeding the remaining allocation (client-side).");

  log("\n--- B3: R&D with NO allocation (dept never got a cap) ---");
  const noAlloc = fixtures().filter(b => b.type !== "RDCap");
  r = raise(u, "Project", 50000, noAlloc, { projectType: "RD", scenario: "RD/no-alloc" });
  log("blocked" in r ? `    BLOCKED as expected: ${(r as any).blocked}` : "    !! NOT BLOCKED");

  log("\n--- B4: non-ODM user raising R&D (Sales employee) ---");
  r = raise(byId("U-SALES-E"), "Project", 50000, fixtures(), { projectType: "RD", scenario: "RD/non-odm" });
  log("blocked" in r ? `    BLOCKED as expected: ${(r as any).blocked}` : "    !! NOT BLOCKED");
}

// ---------------------------------------------------------------- C. 80% client-order cap
log("\n\n### SECTION C — 80% CLIENT-ORDER CAP ###");
{
  const u = byId("U-ODM-E");
  log("--- C1: order 10L, budget 8.5L (>80%) ---");
  let r = raise(u, "Project", 850000, fixtures(), { clientOrderINR: 1000000, scenario: "CAP80/850k" });
  log("blocked" in r ? `    BLOCKED as expected: ${(r as any).blocked}` : "    !! NOT BLOCKED — 80% cap failed");
  log("--- C2: order 10L, budget 8L (=80%, allowed) ---");
  r = raise(u, "Project", 800000, fixtures(), { clientOrderINR: 1000000, scenario: "CAP80/800k" });
  if ("req" in r) { const { path, final } = runChain(r.req, "CAP80/800k", false); log(`    OK, raised. PATH: ${path.join(" → ")} FINAL: ${final.status} (8L ≥ 5L tier)`); }
  log("--- C3: extension blowing combined cap: parent 10L/order 20L (cap 16L), ext 6.5L ---");
  r = raise(byId("U-ODM-ALL"), "Extension", 650000, fixtures(), { extensionFor: "PRJ-ODM-1", scenario: "CAP80/ext-6.5L" });
  log("blocked" in r ? `    BLOCKED as expected: ${(r as any).blocked}` : "    !! NOT BLOCKED — combined extension cap failed");
}

// ---------------------------------------------------------------- D. SuperManager override + rejection + duplicate approval
log("\n\n### SECTION D — OVERRIDES, REJECTION, DOUBLE-APPROVAL ###");
{
  const u = byId("U-ODM-E");
  const mk = () => { const r = raise(u, "Project", 250000, fixtures(), { scenario: "SM-override" }); return (r as any).req; };
  let req = mk();
  log(`--- D1: SuperManager override at ${req.currentStage} on a 2.5L budget ---`);
  const after = approveBudget(req, byId("U-SM1"));
  log(`    U-SM1 approves at DeptApproval → ${after.currentStage} (skips VP and FinanceHead entirely)`);
  flag("SM_OVERRIDE_SKIPS_ALL", "MEDIUM", "SM-override", `A SuperManager approval at ANY early stage takes a Budget straight to Active — a 2.5L (even 50L) budget never passes VP/CEO/FinanceHead. By design ("special access"), but it is a single-person full bypass of every financial control, with no second SuperManager countersign (PO SuperManagerApproval requires their stage; budgets do not).`);

  log("--- D2: rejection at VP stage ---");
  req = mk(); req = approveBudget(req, byId("U-ODM-ALL")); req = approveBudget(req, byId("U-ODM-PROJ"));
  log(`    after dept approvals: ${req.currentStage}`);
  const rejected = { ...req, currentStage: "Rejected", status: "Rejected", history: [...req.history, { action: `Rejected at ${getStageLabel("VP", "Budget")}`, by: "Vikram Vp", byId: "U-VP", at: ts(), comments: "not justified" }] };
  const postRejectActors = ROSTER.filter(x => canUserActOnRequest(x, rejected));
  log(`    after rejection: status=${rejected.status}; users who can still act: ${postRejectActors.map(a => a.id).join(", ") || "(none — correct)"}`);
  if (postRejectActors.length === 0) flag("REJECT_TERMINAL_OK", "PASS", "D2", "Rejected requests are terminal — nobody can act on them afterwards.");

  log("--- D3: same dept approver approving twice (multi-approver consensus) ---");
  const odmReq = (raise(byId("U-ODM-E"), "Project", 50000, fixtures(), { scenario: "D3" }) as any).req;
  log(`    ODM project: selectedApprovers=[${odmReq.selectedApprovers.join(", ")}] (consensus of ${odmReq.selectedApprovers.length})`);
  let r1 = approveBudget(odmReq, byId("U-ODM-ALL"));
  log(`    after U-ODM-ALL approves: ${r1.status}`);
  const dupOK = canUserActOnRequest(byId("U-ODM-ALL"), r1);
  log(`    U-ODM-ALL tries to approve again: canAct=${dupOK} ${dupOK ? "!! DOUBLE-APPROVE POSSIBLE" : "(blocked — correct)"}`);
  if (!dupOK) flag("DOUBLE_APPROVE_BLOCKED", "PASS", "D3", "An approver who already approved at DeptApproval cannot approve again (hasApproved check).");
  else flag("DOUBLE_APPROVE", "CRITICAL", "D3", "Same approver can satisfy a 2-person consensus alone.");
  r1 = approveBudget(r1, byId("U-ODM-PROJ"));
  log(`    after U-ODM-PROJ approves: ${r1.currentStage} (consensus complete)`);

  log("--- D4: read-only + no-dept users ---");
  log(`    U-RO raise: ${(raise(byId("U-RO"), "Monthly", 50000, fixtures()) as any).blocked}`);
  log(`    U-NODEPT raise: ${(raise(byId("U-NODEPT"), "Monthly", 50000, fixtures()) as any).blocked}`);
  const anyAct = [req, r1].some(rr => canUserActOnRequest(byId("U-RO"), rr));
  log(`    U-RO can act on any in-flight request: ${anyAct}`);
  if (!anyAct) flag("READONLY_OK", "PASS", "D4", "Read-only employees can neither raise nor act on budget requests (client-side).");
}

// ---------------------------------------------------------------- E. full matrix
log("\n\n### SECTION E — FULL MATRIX (every user × Monthly/Project/Extension × 50k/2.5L/7.5L) ###");
log("user            type       amount   result");
log("-".repeat(110));
const MATRIX_AMOUNTS = [50000, 250000, 750000];
let raised = 0, blockedCt = 0, active = 0, stuckCt = 0;
for (const u of ROSTER) {
  for (const type of ["Monthly", "Project", "Extension"]) {
    for (const amt of MATRIX_AMOUNTS) {
      const budgets = fixtures();
      const ownFixture = budgets.find(b => b.type === "Project" && b.dept === u.dept);
      const opts: any = { scenario: `${u.id}/${type}/${L(amt)}` };
      if (type === "Extension") opts.extensionFor = (ownFixture || budgets[0]).projectId; // own-dept project if it exists, else cross-dept (ODM)
      const r = raise(u, type, amt, budgets, opts);
      let result: string;
      if ("blocked" in r) { blockedCt++; result = `BLOCKED — ${(r as any).blocked}`; }
      else {
        raised++;
        const { path, final, stuck } = runChain((r as any).req, opts.scenario, false);
        if (stuck) stuckCt++; else if (final.currentStage === "Active") active++;
        result = path.join("→");
      }
      log(`${u.id.padEnd(15)} ${type.padEnd(10)} ${L(amt).padEnd(8)} ${result}`);
    }
  }
}
log("-".repeat(110));
log(`matrix: ${raised} raised (${active} reached Active, ${stuckCt} stuck), ${blockedCt} blocked by form gates`);

// ---------------------------------------------------------------- F. findings summary
log("\n\n### FINDINGS SUMMARY ###");
const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, PASS: 4 } as any;
const sorted = [...FINDINGS].sort((a, b) => order[a.sev] - order[b.sev] || a.code.localeCompare(b.code));
let lastSev = "";
for (const f of sorted) {
  if (f.sev !== lastSev) { log(`\n[${f.sev}]`); lastSev = f.sev; }
  log(`  ${f.code}  (first seen: ${f.scenario})`);
  log(`    ${f.msg}`);
}
log(`\nTotal: ${FINDINGS.filter(f => f.sev !== "PASS").length} issues, ${FINDINGS.filter(f => f.sev === "PASS").length} passing checks.`);
