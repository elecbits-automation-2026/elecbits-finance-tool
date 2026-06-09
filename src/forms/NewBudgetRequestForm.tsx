import { useState } from "react";
import { PiggyBank, Briefcase, Target, TrendingUp, Coins, AlertTriangle, CheckCircle2 } from "lucide-react";
import { EXPENSE_TYPES, NON_PROJECT_DEPTS, MAX_BUDGET_RATIO, VP_THRESHOLD, CEO_THRESHOLD, USERS } from "../constants";
import { isHODLevel } from "../lib/access";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, getStageLabel } from "../lib/workflow";
import { getRDAllocation } from "../lib/finance";
import { CurrencyInput } from "../components/CurrencyInput";
import { AttachmentInput } from "../components/AttachmentInput";
import { FlowPreview } from "../components/FlowPreview";

// ============ NEW BUDGET FORM ============
export function NewBudgetRequestForm({ user, budgets, requests, saveBudgets, addNotifications, showToast, onSuccess }) {
  const initialBudgetType = NON_PROJECT_DEPTS.includes(user.dept) ? "Monthly" : "Project";
  const [budgetType, setBudgetType] = useState(initialBudgetType);
  const [projectType, setProjectType] = useState(null);
  const [form, setForm] = useState({
    projectId: "", projectName: "", client: "", startDate: "", endDate: "",
    clientOrderValue: "", clientOrderCurrency: "INR", clientOrderFxRate: 1,
    amount: "", currency: "INR", fxRate: 1,
    category: "", month: new Date().toISOString().slice(0, 7),
    extensionFor: "", reason: "", scope: "", attachment: null,
    rdType: "", justification: "", expectedOutcome: "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountINR = form.currency === "INR" ? parseFloat(form.amount || 0) : parseFloat(form.amount || 0) * parseFloat(form.fxRate || 0);
  const clientOrderINR = form.clientOrderCurrency === "INR" ? parseFloat(form.clientOrderValue || 0) : parseFloat(form.clientOrderValue || 0) * parseFloat(form.clientOrderFxRate || 0);
  const maxAllowedBudget = clientOrderINR * MAX_BUDGET_RATIO;

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
    const supers = USERS.filter(u => u.role === "SuperManager");
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
  const canRaiseMonthly = isHODLevel(user);
  const canRaiseExtension = isHODLevel(user);
  const canRaiseRD = user.dept === "ODM" && (user.role === "Employee" || isHODLevel(user));

  const eligibleApprovers = getEligibleDeptApprovers(user, { requiresProject: true, category: "Project" }, true);
  const needsMid = needsBoxBuildMidApproval(user);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); setErr(""); };
    reader.readAsDataURL(file);
  }

  function resetProjectType() { setProjectType(null); setForm({ ...form, projectId: "", projectName: "", client: "", clientOrderValue: "", amount: "", rdType: "", justification: "", expectedOutcome: "", scope: "" }); }

  async function submit() {
    setErr("");
    if (!form.amount || amountINR <= 0) return setErr("Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");

    if (budgetType === "Project") {
      if (!projectType) return setErr("Select Client or R&D");
      if (!form.projectId.trim()) return setErr("Project ID required");
      if (!form.projectName.trim()) return setErr("Project Name required");
      if (budgets.find(b => b.type === "Project" && b.projectId === form.projectId && !["Rejected", "Cancelled"].includes(b.status))) return setErr("Budget already exists for this Project ID. Raise an Extension.");

      if (projectType === "Client") {
        if (!form.client.trim()) return setErr("Client name required");
        if (!form.clientOrderValue || clientOrderINR <= 0) return setErr("Client Order Value required");
        if (!form.scope.trim()) return setErr("Scope required");
        if (amountINR > maxAllowedBudget) return setErr(`Budget cannot exceed 80% of Client Order (max ₹${(maxAllowedBudget / 100000).toFixed(2)}L).`);
      } else if (projectType === "RD") {
        if (!canRaiseRD) return setErr("Only ODM can raise R&D budgets.");
        if (!form.rdType) return setErr("R&D Type required");
        if (!form.justification.trim()) return setErr("Justification required");
        if (!form.expectedOutcome.trim()) return setErr("Expected Outcome required");
        if (rdAllocated == null) return setErr(`No R&D budget allocated for ${user.dept} for ${currentMonth}. Request an allocation from management below.`);
        if (amountINR > rdAvailableThisMonth) return setErr(`Exceeds allocated R&D budget. Available: ₹${(rdAvailableThisMonth / 1000).toFixed(1)}K. Use Extension instead.`);
      }
    } else if (budgetType === "Monthly") {
      if (!form.category) return setErr("Category required");
      if (!form.month) return setErr("Month required");
    } else if (budgetType === "Extension") {
      if (!form.extensionFor) return setErr("Select project to extend");
      if (!form.reason.trim()) return setErr("Reason required");
      const existing = budgets.find(b => b.projectId === form.extensionFor && b.type === "Project");
      if (existing && existing.projectType === "Client") {
        const exts = budgets.filter(b => b.type === "Extension" && b.extensionFor === form.extensionFor && (b.status === "Active" || b.currentStage === "Active"));
        const extTotal = exts.reduce((s, e) => s + e.amountINR, 0);
        const max = existing.clientOrderValue * MAX_BUDGET_RATIO;
        if (existing.amountINR + extTotal + amountINR > max) return setErr(`Extension exceeds 80% cap. Max: ₹${(max / 100000).toFixed(2)}L.`);
      }
    }

    if (!form.attachment) return setErr("Attachment mandatory");

    setSubmitting(true);
    const now = new Date().toISOString();
    const selectedApproverIds = eligibleApprovers.map(a => a.id);
    const initialStage = needsMid && user.dept === "Box Build" && user.role === "Employee" ? "BoxBuildMid" : "DeptApproval";

    const newBudget = {
      id: "BUD-" + Date.now(), kind: "Budget", type: budgetType, projectType: budgetType === "Project" ? projectType : undefined,
      createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
      projectId: form.projectId, projectName: form.projectName, client: form.client,
      startDate: form.startDate, endDate: form.endDate,
      clientOrderValue: projectType === "Client" ? clientOrderINR : 0,
      clientOrderValueCurrency: form.clientOrderCurrency, clientOrderValueFxRate: parseFloat(form.clientOrderFxRate),
      amount: parseFloat(form.amount), currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR,
      category: form.category, month: form.month,
      extensionFor: form.extensionFor, reason: form.reason, scope: form.scope, attachment: form.attachment,
      rdType: form.rdType, justification: form.justification, expectedOutcome: form.expectedOutcome,
      selectedApprovers: selectedApproverIds, currentStage: initialStage, status: getStageLabel(initialStage, "Budget"),
      history: [{ action: "Submitted", by: user.name, byId: user.id, at: now, comments: `${budgetType} budget request raised` }],
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
      {!canRaiseExtension && budgetType === "Extension" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">Only Department Heads can raise Extensions.</div>}

      {budgetType === "Project" && canRaiseProject && !projectType && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">Project type?</div>
          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={() => setProjectType("Client")} className="text-left bg-white border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Briefcase className="w-5 h-5" /></div><div className="font-bold">Client Project</div></div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>✓ Order received from client</div>
                <div>✓ Budget ≤ 80% of order value</div>
                <div>✓ 20% margin enforced</div>
              </div>
            </button>
            <button onClick={() => canRaiseRD ? setProjectType("RD") : setErr("Only ODM can raise R&D")} disabled={!canRaiseRD} className={`text-left bg-white border-2 rounded-xl p-5 ${canRaiseRD ? "border-slate-200 hover:border-fuchsia-400 hover:bg-fuchsia-50" : "border-slate-100 opacity-50 cursor-not-allowed"}`}>
              <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg flex items-center justify-center"><Target className="w-5 h-5" /></div><div className="font-bold">Internal / R&D</div></div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>✓ ODM only</div>
                <div>{rdAllocated != null ? `✓ Allocated this month: ₹${(rdAllocated / 1000).toFixed(0)}K (avail: ₹${(rdAvailableThisMonth / 1000).toFixed(1)}K)` : "⚠ No budget allocated this month"}</div>
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
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project ID *</label><input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="EB-XX-XX-XXX-XX-XXXX" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Name *</label><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Client *</label><input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Start</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">End</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2"><Coins className="w-4 h-4 text-amber-700" /><span className="text-sm font-bold text-amber-900">Client Order Value (excl. GST)</span></div>
              <CurrencyInput value={form.clientOrderValue} currency={form.clientOrderCurrency} fxRate={form.clientOrderFxRate} onChange={(v) => setForm({ ...form, clientOrderValue: v.amount, clientOrderCurrency: v.currency, clientOrderFxRate: v.fxRate })} label="Billed value (excl. GST)" required />
              {clientOrderINR > 0 && <div className="mt-3 bg-white rounded p-2 text-xs"><div className="text-amber-900 font-semibold">📊 Max Budget: ₹{(maxAllowedBudget / 100000).toFixed(2)}L (80%)</div></div>}
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
                {EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
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
                {budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active")).map(b => <option key={b.projectId} value={b.projectId}>[{b.projectType === "RD" ? "R&D" : "Client"}] {b.projectId} — {b.projectName}</option>)}
              </select>
            </div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Extension Amount" required />
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason *</label><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </>
        )}

        {(budgetType !== "Project" || projectType) && (
          <>
            <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required label="Supporting Document" />
            {amountINR > 0 && <FlowPreview steps={[user.name, "Dept Head", amountINR >= VP_THRESHOLD && amountINR < CEO_THRESHOLD ? "VP" : null, amountINR >= CEO_THRESHOLD ? "VP + CEO" : null, "Finance Head", "Active"].filter(Boolean)} />}
            {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : `Submit ${budgetType} Budget`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
