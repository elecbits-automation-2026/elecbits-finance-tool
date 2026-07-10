import { useState } from "react";
import { PiggyBank, Briefcase, Target, TrendingUp, Coins, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { MONTHLY_BUDGET_CATEGORIES, NON_PROJECT_DEPTS, MAX_BUDGET_RATIO, VP_THRESHOLD, CEO_THRESHOLD } from "../constants";
import { isHODLevel, isReadOnly, effectiveDepts } from "../lib/access";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, getStageLabel, computeNextStage } from "../lib/workflow";
import { getRoster } from "../lib/roster";
import { getRDAllocation, getProjectClientOrderValue, getProjectStars, getApprovedProjects } from "../lib/finance";
import { CurrencyInput } from "../components/CurrencyInput";
import { AttachmentInput } from "../components/AttachmentInput";
import { FlowPreview } from "../components/FlowPreview";
import { uploadAttachment } from "../lib/storage";

// ============ NEW BUDGET FORM ============
export function NewBudgetRequestForm({ user, budgets, pos = [], requests, saveBudgets, addNotifications, showToast, onSuccess, reviseFrom = null }) {
  const initialBudgetType = reviseFrom ? reviseFrom.type : (NON_PROJECT_DEPTS.includes(user.dept) ? "Monthly" : "Project");
  const [budgetType, setBudgetType] = useState(initialBudgetType);
  const [projectType, setProjectType] = useState(reviseFrom ? (reviseFrom.projectType || null) : null);
  const [form, setForm] = useState(reviseFrom ? {
    projectId: reviseFrom.projectId || "", projectName: reviseFrom.projectName || "", client: reviseFrom.client || "",
    startDate: reviseFrom.startDate || "", endDate: reviseFrom.endDate || "",
    clientOrderValue: reviseFrom.clientOrderValue != null ? String(reviseFrom.clientOrderValue) : "", clientOrderCurrency: reviseFrom.clientOrderCurrency || "INR", clientOrderFxRate: reviseFrom.clientOrderFxRate != null ? String(reviseFrom.clientOrderFxRate) : "1",
    amount: reviseFrom.amount != null ? String(reviseFrom.amount) : "", currency: reviseFrom.currency || "INR", fxRate: reviseFrom.fxRate != null ? String(reviseFrom.fxRate) : "1",
    category: reviseFrom.category || "", month: reviseFrom.month || new Date().toISOString().slice(0, 7),
    extensionFor: reviseFrom.extensionFor || "", reason: reviseFrom.reason || "", scope: reviseFrom.scope || "", attachment: null,
    rdType: reviseFrom.rdType || "", justification: reviseFrom.justification || "", expectedOutcome: reviseFrom.expectedOutcome || "",
    marginJustification: reviseFrom.marginJustification || "",
  } : {
    projectId: "", projectName: "", client: "", startDate: "", endDate: "",
    clientOrderValue: "", clientOrderCurrency: "INR", clientOrderFxRate: "1",
    amount: "", currency: "INR", fxRate: "1",
    category: "", month: new Date().toISOString().slice(0, 7),
    extensionFor: "", reason: "", scope: "", attachment: null,
    rdType: "", justification: "", expectedOutcome: "",
    marginJustification: "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountINR = form.currency === "INR" ? parseFloat(form.amount || "0") : parseFloat(form.amount || "0") * parseFloat(form.fxRate || "0");
  // Client order value is DERIVED live from the project's approved PIs — no longer
  // typed. Grows automatically as more PIs are approved for the project.
  const clientOrderINR = getProjectClientOrderValue(pos, form.projectId);
  const maxAllowedBudget = clientOrderINR * MAX_BUDGET_RATIO;
  // Projects that already have >=1 approved PI — the only projects a Client budget
  // can be raised against. Their client-order value = sum of approved PIs.
  const piProjects = getApprovedProjects(pos);
  function selectPiProject(v) {
    const p = piProjects.find(x => x.projectId === v);
    setForm({ ...form, projectId: v, projectName: p?.projectName || "", client: p?.client || "" });
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const rdThisMonth = budgets.filter(b => b.type === "Project" && b.projectType === "RD" && b.dept === user.dept && (b.status === "Active" || b.currentStage === "Active") && (b.approvedDate?.slice(0, 7) === currentMonth || b.createdDate?.slice(0, 7) === currentMonth));
  const rdUsedThisMonth = rdThisMonth.reduce((s, b) => s + b.amountINR, 0);
  // Cap comes from the SuperManager's monthly allocation for this dept+month.
  // No allocation => no cap available; user must request one (notifies SuperManagers).
  const rdAllocation = getRDAllocation(budgets, user.dept, currentMonth);
  const rdAllocated = rdAllocation ? rdAllocation.amountINR : null;
  const rdAvailableThisMonth = rdAllocated != null ? Math.max(0, rdAllocated - rdUsedThisMonth) : 0;
  const [allocRequested, setAllocRequested] = useState(false);

  async function requestRDAllocation() {
    const now = new Date().toISOString();
    const supers = getRoster().filter(u => u.role === "SuperManager");
    const notifs = supers.map((s, i) => ({
      id: "N-" + Date.now() + "-rdalloc-" + i,
      toUserId: s.id,
      title: "R&D Budget Allocation Requested",
      message: `${user.name} (${user.dept}) requests an R&D budget allocation for ${currentMonth}.`,
      at: now, read: false, requestId: null,
    }));
    if (addNotifications) await addNotifications(notifs);
    // Persist the request so it surfaces as a card on the R&D Allocations page
    // (notifications can be missed/dismissed). One open request per dept+month.
    const reqId = `RDCAPREQ-${user.dept}-${currentMonth}`;
    const reqRecord = {
      id: reqId, kind: "RDCapRequest", type: "RDCapRequest",
      dept: user.dept, month: currentMonth, status: "Open",
      requesterId: user.id, requesterName: user.name, requestedAt: now,
    };
    await saveBudgets([reqRecord, ...budgets.filter(b => b.id !== reqId)]);
    setAllocRequested(true);
    showToast?.("Allocation request sent to management", "success");
  }

  const canRaiseProject = !NON_PROJECT_DEPTS.includes(user.dept) && (user.role === "Employee" || isHODLevel(user) || user.role === "DeptApprover");
  // The Finance department's head carries the FinanceHead role (not DeptApprover),
  // so include it here — otherwise the Finance head can't raise the Monthly/
  // Extension budgets the non-project-dept banner says Finance can.
  const canRaiseMonthly = isHODLevel(user) || user.role === "FinanceHead";
  // Extensions extend a project, so anyone who can raise a project (incl. employees
  // in project departments) may extend one — not just department heads.
  const canRaiseExtension = isHODLevel(user) || user.role === "FinanceHead" || canRaiseProject;
  const canRaiseRD = user.dept === "ODM" && (user.role === "Employee" || isHODLevel(user));

  // Monthly budgets are not project work; Project and Extension budgets are. This must
  // match the `isProject` stamped on the record below, or scoped heads (ODM-PROJECT)
  // end up required approvers on requests their visibility rules hide from them.
  const isProjectBudget = budgetType !== "Monthly";
  const eligibleApprovers = getEligibleDeptApprovers(user, { requiresProject: true, category: "Project" }, isProjectBudget);
  const needsMid = needsBoxBuildMidApproval(user);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large."); return; }
    try {
      const att = await uploadAttachment(file);
      setForm(f => ({ ...f, attachment: att }));
      setErr("");
    } catch (err) {
      setErr("Upload failed: " + (err?.message || "please try again"));
    }
  }

  function resetProjectType() { setProjectType(null); setForm({ ...form, projectId: "", projectName: "", client: "", clientOrderValue: "", amount: "", rdType: "", justification: "", expectedOutcome: "", scope: "", reason: "" }); }

  async function submit() {
    setErr("");
    if (isReadOnly(user)) return setErr("Your account is read-only and cannot raise requests.");
    if (!user.dept) return setErr("Your account has no department assigned. Ask an admin to set your department before raising requests.");
    // Role gates must be enforced here, not just on the type buttons: for non-project
    // departments the form OPENS with budgetType="Monthly", so a disabled button alone
    // does not stop an ordinary employee from submitting a Monthly budget.
    if (budgetType === "Monthly" && !canRaiseMonthly) return setErr("Only Department Heads can raise Monthly Budgets.");
    if (budgetType === "Extension" && !canRaiseExtension) return setErr("Extensions can only be raised by members of a project department.");
    if (budgetType === "Project" && !canRaiseProject) return setErr("Your department cannot raise Project budgets.");
    // Without a configured approver the request would be born stuck at DeptApproval
    // with nobody able to act on it (e.g. "Other" / Executive-employee departments).
    if (eligibleApprovers.length === 0) return setErr("No approver is configured for your department. Ask an admin to set up an approval chain before raising requests.");
    if (!form.amount || amountINR <= 0) return setErr("Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");

    if (budgetType === "Project") {
      if (!projectType) return setErr("Select Client, R&D or One-Time");
      if (projectType === "OneTime") {
        // A one-time budget is a one-off spend: only a reason is required. The
        // project id/name are auto-generated below so it stays spendable and
        // unique without the user filling them in.
        if (!form.reason.trim()) return setErr("Reason required");
      } else {
        if (!form.projectId.trim()) return setErr("Project ID required");
        if (!form.projectName.trim()) return setErr("Project Name required");
        if (budgets.find(b => b.type === "Project" && b.projectId === form.projectId && !["Rejected", "Cancelled"].includes(b.status))) return setErr("Budget already exists for this Project ID. Raise an Extension.");

        if (projectType === "Client") {
          if (!form.client.trim()) return setErr("Client name required");
          if (clientOrderINR <= 0) return setErr("This project has no approved PI yet. Raise a Client PI for it and get it approved first — the client order value comes from its approved PIs.");
          if (!form.scope.trim()) return setErr("Scope required");
          if (amountINR > maxAllowedBudget) return setErr(`Budget cannot exceed 80% of the client order value (from approved PIs: ₹${(clientOrderINR / 100000).toFixed(2)}L → max ₹${(maxAllowedBudget / 100000).toFixed(2)}L).`);
        } else if (projectType === "RD") {
          if (!canRaiseRD) return setErr("Only ODM can raise R&D budgets.");
          if (!form.rdType) return setErr("R&D Type required");
          if (!form.justification.trim()) return setErr("Justification required");
          if (!form.expectedOutcome.trim()) return setErr("Expected Outcome required");
          if (rdAllocated == null) return setErr(`No R&D budget allocated for ${user.dept} for ${currentMonth}. Request an allocation from management below.`);
          if (amountINR > rdAvailableThisMonth) return setErr(`Exceeds allocated R&D budget. Available: ₹${(rdAvailableThisMonth / 1000).toFixed(1)}K. Use Extension instead.`);
        }
      }
    } else if (budgetType === "Monthly") {
      if (!form.category) return setErr("Category required");
      if (!form.month) return setErr("Month required");
      // One monthly pool per dept + category + month — a duplicate would be silently
      // ignored (only the first is ever matched), orphaning the budget.
      const dup = budgets.find(b => b.type === "Monthly" && b.dept === user.dept && b.category === form.category && b.month === form.month && !["Rejected", "Cancelled"].includes(b.status));
      if (dup) return setErr(`A Monthly ${form.category} budget for ${user.dept} · ${form.month} already exists (${dup.status}). Edit or extend it instead of raising a duplicate.`);
    } else if (budgetType === "Extension") {
      if (!form.extensionFor) return setErr("Select project to extend");
      if (!form.reason.trim()) return setErr("Reason required");
      const existing = budgets.find(b => b.projectId === form.extensionFor && b.type === "Project");
      if (!existing) return setErr("Project to extend not found.");
      // An extension is approved by the REQUESTER's department chain, so the parent
      // project must belong to one of the requester's departments — otherwise any head
      // could inflate another department's project budget through their own approvers.
      if (!effectiveDepts(user).includes(existing.dept)) return setErr("You can only extend projects belonging to your own department.");
      if (existing.projectType === "Client") {
        const exts = budgets.filter(b => b.type === "Extension" && b.extensionFor === form.extensionFor && (b.status === "Active" || b.currentStage === "Active"));
        const extTotal = exts.reduce((s, e) => s + e.amountINR, 0);
        // Live client-order value from approved PIs; fall back to the legacy stored
        // value for older projects that predate PI-driven COV.
        const cov = getProjectClientOrderValue(pos, form.extensionFor) || existing.clientOrderValue || 0;
        const committedAfter = existing.amountINR + extTotal + amountINR;
        // HARD STOP at 100% of COV — you can never commit more than the client pays.
        if (committedAfter > cov) return setErr(`Hard stop: total budget would reach ₹${(committedAfter / 100000).toFixed(2)}L, above the client order value of ₹${(cov / 100000).toFixed(2)}L. You cannot commit more than the client pays.`);
        // Past 80% dips into the 20% margin — allowed WITH a justification (it costs
        // margin stars). The first budget still can't cross 80% on its own.
        if (committedAfter > cov * MAX_BUDGET_RATIO && !form.marginJustification.trim()) {
          return setErr(`This extension dips into the 20% margin (past ₹${(cov * MAX_BUDGET_RATIO / 100000).toFixed(2)}L of ₹${(cov / 100000).toFixed(2)}L). Add a margin justification — it will cost margin stars.`);
        }
      }
    }

    if (!form.attachment) return setErr("Attachment mandatory");

    setSubmitting(true);
    const now = new Date().toISOString();
    // Segregation of duties: a request must never be routed to its own raiser. Drop the
    // raiser from the eligible approver set (e.g. a department head raising their own
    // budget would otherwise be able to approve it).
    const selectedApproverIds = eligibleApprovers.map(a => a.id).filter(id => id !== user.id);
    const needsMidStage = needsMid && user.dept === "Box Build" && user.role === "Employee";
    // If removing the raiser leaves no in-department approver (a sole department head
    // raising their own request), skip the dept stage and escalate straight to the next
    // authority in the chain (VP / CEO / Finance Head, by amount) — so the request can
    // still be approved by someone independent rather than being stuck or self-approved.
    const initialStage = needsMidStage
      ? "BoxBuildMid"
      : (selectedApproverIds.length === 0
          // A Finance Head raising their own budget can't be approved at the
          // Finance stage (they are it), so escalate straight to VP (then CEO by
          // amount). Any other sole head escalates to the next authority by amount.
          ? (user.role === "FinanceHead"
              ? "VP"
              : computeNextStage({ kind: "Budget", amountINR, type: budgetType }, "DeptApproval", null))
          : "DeptApproval");

    // One-time budgets carry no user-entered project id/name; auto-generate a
    // unique id (so it's spendable via the project payment flow and passes the
    // server's unique-projectId guard) and a readable name from the reason.
    const isOneTime = budgetType === "Project" && projectType === "OneTime";
    const oneTimeProjectId = "OT-" + Date.now();
    const oneTimeProjectName = "One-Time: " + form.reason.trim().slice(0, 50);

    const newBudget = {
      id: "BUD-" + Date.now(), kind: "Budget", type: budgetType, projectType: budgetType === "Project" ? projectType : undefined,
      isProject: isProjectBudget,
      createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
      projectId: isOneTime ? oneTimeProjectId : form.projectId, projectName: isOneTime ? oneTimeProjectName : form.projectName, client: form.client,
      startDate: form.startDate, endDate: form.endDate,
      clientOrderValue: projectType === "Client" ? clientOrderINR : 0,
      clientOrderValueCurrency: form.clientOrderCurrency, clientOrderValueFxRate: parseFloat(form.clientOrderFxRate),
      amount: parseFloat(form.amount), currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR,
      category: form.category, month: form.month,
      extensionFor: form.extensionFor, reason: form.reason, scope: form.scope, attachment: form.attachment,
      rdType: form.rdType, justification: form.justification, expectedOutcome: form.expectedOutcome,
      marginJustification: form.marginJustification || "",
      selectedApprovers: selectedApproverIds, currentStage: initialStage, status: getStageLabel(initialStage, "Budget"),
      revisedFrom: reviseFrom?.id || null,
      revisionNote: reviseFrom ? (reviseFrom.returnRemarks || "") : "",
      revisionRound: reviseFrom ? (reviseFrom.revisionRound || 0) + 1 : 0,
      history: [{ action: "Submitted", by: user.name, byId: user.id, at: now, comments: reviseFrom ? `${budgetType} budget re-sent after return for changes` : `${budgetType} budget request raised` }],
    };
    await saveBudgets([newBudget, ...budgets]);
    setSubmitting(false);
    onSuccess();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-900">Raise Budget Request</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">Budgets must be approved before payment requests can be raised.</p>

      <div className={`grid gap-2 mb-5 ${canRaiseProject ? "grid-cols-3" : "grid-cols-2"}`}>
        {canRaiseProject && (
          <button onClick={() => { setBudgetType("Project"); resetProjectType(); }} className={`px-3 py-3 rounded-lg text-sm font-semibold border ${budgetType === "Project" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700 hover:border-indigo-400"}`}>
            <Briefcase className="w-4 h-4 inline mr-1" />Project Budget
          </button>
        )}
        <button onClick={() => { setBudgetType("Monthly"); resetProjectType(); }} disabled={!canRaiseMonthly} className={`px-3 py-3 rounded-lg text-sm font-semibold border ${budgetType === "Monthly" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"} ${!canRaiseMonthly ? "opacity-40 cursor-not-allowed" : "hover:border-indigo-400"}`}>
          <Target className="w-4 h-4 inline mr-1" />Monthly
        </button>
        <button onClick={() => { setBudgetType("Extension"); resetProjectType(); }} disabled={!canRaiseExtension} className={`px-3 py-3 rounded-lg text-sm font-semibold border ${budgetType === "Extension" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"} ${!canRaiseExtension ? "opacity-40 cursor-not-allowed" : "hover:border-indigo-400"}`}>
          <TrendingUp className="w-4 h-4 inline mr-1" />Extension
        </button>
      </div>

      {NON_PROJECT_DEPTS.includes(user.dept) && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          <strong>{user.dept}</strong> can raise Monthly Budgets and Extensions only.
        </div>
      )}
      {!canRaiseMonthly && budgetType === "Monthly" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">Only Department Heads can raise Monthly Budgets.</div>}
      {!canRaiseExtension && budgetType === "Extension" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">Extensions can only be raised by members of a project department.</div>}

      {budgetType === "Project" && canRaiseProject && !projectType && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">Project type?</div>
          {/* Internal / R&D is ODM-only, so it's shown only to ODM users — others
              never see a card they can't use. */}
          <div className={`grid gap-3 ${canRaiseRD ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <button onClick={() => setProjectType("Client")} className="text-left bg-white border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Briefcase className="w-5 h-5" /></div><div className="font-bold">Client Project</div></div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>✓ Order received from client</div>
                <div>✓ Budget ≤ 80% of order value</div>
                <div>✓ 20% margin enforced</div>
              </div>
            </button>
            {canRaiseRD && (
              <button onClick={() => setProjectType("RD")} className="text-left bg-white border-2 border-slate-200 hover:border-fuchsia-400 hover:bg-fuchsia-50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg flex items-center justify-center"><Target className="w-5 h-5" /></div><div className="font-bold">Internal / R&D</div></div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>✓ ODM only</div>
                  <div>{rdAllocated != null ? `✓ Allocated this month: ₹${(rdAllocated / 1000).toFixed(0)}K (avail: ₹${(rdAvailableThisMonth / 1000).toFixed(1)}K)` : "⚠ No budget allocated this month"}</div>
                </div>
              </button>
            )}
            <button onClick={() => setProjectType("OneTime")} className="text-left bg-white border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><Zap className="w-5 h-5" /></div><div className="font-bold">One-Time Budget</div></div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>✓ One-off spend</div>
                <div>✓ Reason + amount + doc</div>
                <div>✓ Same approval flow</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {budgetType === "Project" && projectType && (
        <button onClick={resetProjectType} className="mb-4 text-xs text-blue-600 hover:text-blue-700 font-medium">← Change project type</button>
      )}

      <div className="space-y-4">
        {budgetType === "Project" && projectType === "Client" && (
          <>
            {piProjects.length === 0 ? (
              <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900"><AlertTriangle className="w-4 h-4 inline mr-1" />No project has an approved PI yet. Raise and get a <strong>Client PI</strong> approved first — a Client budget draws its value from approved PIs.</div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project * <span className="text-slate-400 font-normal">(with approved PI)</span></label>
                    <select value={form.projectId} onChange={(e) => selectPiProject(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="">Select project</option>
                      {piProjects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectId} — {p.projectName}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label><input value={form.client} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600" placeholder="From the PI" /></div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Start</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">End</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-1.5 mb-1"><Coins className="w-4 h-4 text-amber-700" /><span className="text-sm font-bold text-amber-900">Client Order Value — from approved PIs</span></div>
                  {form.projectId ? (
                    <div className="text-xs text-amber-900">Total of approved PIs for <span className="font-mono">{form.projectId}</span>: <strong>₹{(clientOrderINR / 100000).toFixed(2)}L</strong>. {clientOrderINR > 0 ? <>Max budget (80%): <strong>₹{(maxAllowedBudget / 100000).toFixed(2)}L</strong>. Approve more PIs to raise this.</> : "No approved PI for this project yet."}</div>
                  ) : (
                    <div className="text-xs text-amber-800">Select a project — its client order value is the total of its approved PIs.</div>
                  )}
                </div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Scope *</label><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Total Budget" required />
                {amountINR > 0 && clientOrderINR > 0 && (
                  <div className={`rounded-lg p-3 text-sm ${amountINR > maxAllowedBudget ? "bg-red-50 border border-red-200 text-red-900" : "bg-emerald-50 border border-emerald-200 text-emerald-900"}`}>
                    {amountINR > maxAllowedBudget ? <><AlertTriangle className="w-4 h-4 inline mr-1" /><strong>BLOCKED:</strong> exceeds 80% cap.</> : <><CheckCircle2 className="w-4 h-4 inline mr-1" /><strong>OK:</strong> Margin {(((clientOrderINR - amountINR) / clientOrderINR) * 100).toFixed(1)}%</>}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {budgetType === "Project" && projectType === "RD" && (
          <>
            {rdAllocated != null ? (
              <div className={`rounded-lg p-3 border ${rdUsedThisMonth >= rdAllocated ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex justify-between text-xs font-semibold"><span>R&D Budget ({currentMonth})</span><span>₹{(rdUsedThisMonth / 1000).toFixed(1)}K / ₹{(rdAllocated / 1000).toFixed(0)}K allocated</span></div>
                <div className="text-xs">Available: <strong>₹{(rdAvailableThisMonth / 1000).toFixed(1)}K</strong></div>
              </div>
            ) : (
              <div className="rounded-lg p-3 border bg-amber-50 border-amber-200">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 mb-1"><AlertTriangle className="w-4 h-4" />No R&D budget allocated for {user.dept} ({currentMonth})</div>
                <div className="text-xs text-amber-800 mb-2">Management has not set an R&D budget for your department this month. Request one to proceed.</div>
                <button type="button" onClick={requestRDAllocation} disabled={allocRequested} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white">
                  {allocRequested ? "Request sent ✓" : "Request allocation from management"}
                </button>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project ID *</label><input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Name *</label><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">R&D Type *</label>
              <select value={form.rdType} onChange={(e) => setForm({ ...form, rdType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select</option><option>Internal Product Development</option><option>Sample Development</option><option>Pure R&D</option><option>Prototype</option>
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Justification *</label><textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Expected Outcome *</label><textarea value={form.expectedOutcome} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="R&D Budget" required />
          </>
        )}

        {budgetType === "Project" && projectType === "OneTime" && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
              A one-time budget is a one-off approved spend. It uses the same approval flow as project budgets (Dept Head → Finance Head → VP/CEO by amount). Once active, payment requests can be raised against it.
            </div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason *</label><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} placeholder="What is this one-time budget for?" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Amount" required />
          </>
        )}

        {budgetType === "Monthly" && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label><input value={user.dept} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Month *</label><input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select</option>
                {MONTHLY_BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Monthly Amount" required />
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Justification *</label><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </>
        )}

        {budgetType === "Extension" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Extend which Project? *</label>
              <select value={form.extensionFor} onChange={(e) => setForm({ ...form, extensionFor: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select</option>
                {budgets.filter(b => b.type === "Project" && b.projectType !== "OneTime" && (b.status === "Active" || b.currentStage === "Active") && effectiveDepts(user).includes(b.dept)).map(b => <option key={b.projectId} value={b.projectId}>[{b.projectType === "RD" ? "R&D" : "Client"}] {b.projectId} — {b.projectName}</option>)}
              </select>
            </div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Extension Amount" required />
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason *</label><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            {form.extensionFor && (() => {
              const existing = budgets.find(b => b.projectId === form.extensionFor && b.type === "Project");
              if (!existing || existing.projectType !== "Client") return null;
              const cov = getProjectClientOrderValue(pos, form.extensionFor) || existing.clientOrderValue || 0;
              if (cov <= 0) return null;
              const exts = budgets.filter(b => b.type === "Extension" && b.extensionFor === form.extensionFor && (b.status === "Active" || b.currentStage === "Active"));
              const extTotal = exts.reduce((s, e) => s + e.amountINR, 0);
              const committedAfter = existing.amountINR + extTotal + amountINR;
              const marginLine = cov * MAX_BUDGET_RATIO;
              const eatsMargin = committedAfter > marginLine;
              const overHard = committedAfter > cov;
              const r = cov > 0 ? committedAfter / cov : 0;
              let ps = r <= 0.60 ? 6 : r <= 0.80 ? 5 + (0.80 - r) / 0.20 : r < 1.00 ? 5 * (1 - (r - 0.80) / 0.20) : 0;
              ps = Math.round(ps * 10) / 10;
              return (
                <>
                  <div className={`rounded-lg p-3 border text-sm ${overHard ? "bg-red-50 border-red-200 text-red-900" : eatsMargin ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
                    <div className="text-xs">Project value: <strong>₹{(cov / 100000).toFixed(2)}L</strong> · 20% margin line: ₹{(marginLine / 100000).toFixed(2)}L · committed after this: <strong>₹{(committedAfter / 100000).toFixed(2)}L</strong></div>
                    {overHard ? <div className="mt-1 font-semibold"><AlertTriangle className="w-4 h-4 inline mr-1" />Hard stop — this would exceed 100% of the client order value.</div>
                      : eatsMargin ? <div className="mt-1"><strong>Dips into the 20% margin.</strong> If fully spent, this project would rate <strong>★ {ps.toFixed(1)}</strong> / 6. Justify below.</div>
                      : <div className="mt-1"><CheckCircle2 className="w-4 h-4 inline mr-1" />Within the 20% margin — no star cost.</div>}
                  </div>
                  {eatsMargin && !overHard && (
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Margin justification * <span className="font-normal text-slate-500">(why this dips into the 20% margin)</span></label><textarea value={form.marginJustification} onChange={(e) => setForm({ ...form, marginJustification: e.target.value })} rows={2} className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm" /></div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {(budgetType !== "Project" || projectType) && (
          <>
            <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required label="Supporting Document" />
            {amountINR > 0 && <FlowPreview steps={[user.name, "Dept Head", "Finance Head", amountINR >= VP_THRESHOLD ? "VP" : null, amountINR >= CEO_THRESHOLD ? "CEO" : null, "Active"].filter(Boolean)} />}
            {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : projectType === "OneTime" ? "Submit One-Time Budget" : `Submit ${budgetType} Budget`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
