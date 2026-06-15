import { useState } from "react";
import { RotateCcw, Wallet, AlertTriangle, FileSignature, Edit3, Target } from "lucide-react";
import { EXPENSE_TYPES, NON_PROJECT_DEPTS, VP_THRESHOLD, CEO_THRESHOLD } from "../constants";
import { isReadOnly } from "../lib/access";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, getStageLabel } from "../lib/workflow";
import { getRoster } from "../lib/roster";
import { getActiveBudgetForProject, getActiveMonthlyBudget, getMonthlyBudgetUsage, getApprovedPOsForProject, getApprovedPOsForDept, getPOUsage, getPOAvailable } from "../lib/finance";
import { CurrencyInput } from "../components/CurrencyInput";
import { AttachmentInput } from "../components/AttachmentInput";
import { FlowPreview } from "../components/FlowPreview";

// ============ NEW PAYMENT REQUEST FORM ============
export function NewPaymentRequestForm({ user, requests, budgets, pos, saveRequests, onSuccess, resubmitFrom = null }) {
  const [form, setForm] = useState(resubmitFrom ? {
    expenseTypeId: resubmitFrom.expenseTypeId,
    projectId: resubmitFrom.projectId || "",
    vendor: resubmitFrom.vendor || "",
    description: resubmitFrom.description || "",
    purpose: resubmitFrom.purpose || "",
    amount: resubmitFrom.amount || "",
    currency: resubmitFrom.currency || "INR",
    fxRate: resubmitFrom.fxRate || 1,
    travelFrom: resubmitFrom.travelFrom || "",
    travelTo: resubmitFrom.travelTo || "",
    travelDates: resubmitFrom.travelDates || "",
    invoiceNumber: resubmitFrom.invoiceNumber || "",
    selectedApproverIds: [],
    attachment: null,
    linkedPOId: resubmitFrom.linkedPOId || "",
  } : {
    expenseTypeId: "", projectId: "", vendor: "", description: "", purpose: "",
    amount: "", currency: "INR", fxRate: 1,
    travelFrom: "", travelTo: "", travelDates: "", invoiceNumber: "",
    selectedApproverIds: [], attachment: null, linkedPOId: "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedType = EXPENSE_TYPES.find(t => t.id === form.expenseTypeId);
  const isProject = selectedType?.requiresProject || false;
  const isTravel = selectedType?.name.includes("Travel");
  const isVendorPayment = selectedType?.name.includes("Vendor Payment");
  const amountINR = form.currency === "INR" ? parseFloat(form.amount || 0) : parseFloat(form.amount || 0) * parseFloat(form.fxRate || 0);

  const eligibleApprovers = getEligibleDeptApprovers(user, selectedType, isProject);
  const needsMid = needsBoxBuildMidApproval(user);
  const isOdmProject = user.dept === "ODM" && isProject && user.role === "Employee";
  const isMultiApprover = eligibleApprovers.length > 1;

  const activeBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBudget = (!isProject && selectedType) ? getActiveMonthlyBudget(budgets, user.dept, selectedType.name, currentMonth) : null;
  const monthlyUsage = monthlyBudget ? getMonthlyBudgetUsage(requests, user.dept, selectedType.name, currentMonth) : null;
  const monthlyAvailable = monthlyBudget ? Math.max(0, monthlyBudget.amountINR - monthlyUsage.total) : 0;

  const projectPOs = isProject && form.projectId ? getApprovedPOsForProject(pos, form.projectId) : [];
  const deptPOs = !isProject && selectedType ? getApprovedPOsForDept(pos, user.dept) : [];
  const linkedPO = form.linkedPOId ? pos.find(p => p.id === form.linkedPOId) : null;
  const poUsage = linkedPO ? getPOUsage(requests, linkedPO.id) : null;
  const poAvailable = linkedPO ? getPOAvailable(linkedPO, requests) : 0;

  // Check if linked PO has a pending edit request
  function hasPendingEdit(poId) {
    return pos.some(p => p.type === "POEdit" && p.editingPOId === poId && !["Approved", "Rejected", "Cancelled"].includes(p.status));
  }
  const linkedPOHasPendingEdit = linkedPO ? hasPendingEdit(linkedPO.id) : false;

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } });
      setErr("");
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (isReadOnly(user)) return setErr("Your account is read-only and cannot raise requests.");
    if (!user.dept) return setErr("Your account has no department assigned. Ask an admin to set your department before raising requests.");
    if (!form.expenseTypeId) return setErr("Select expense type");
    if (!form.description.trim()) return setErr("Description required");
    if (!form.amount || amountINR <= 0) return setErr("Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");
    if (isProject && !form.projectId) return setErr("Project ID required");
    if (!isProject && !form.purpose.trim()) return setErr("Purpose mandatory");
    if (!form.attachment) return setErr("Attachment is mandatory");

    let selectedApproverIds = [];
    if (isOdmProject) selectedApproverIds = eligibleApprovers.map(a => a.id);
    else if (isMultiApprover) {
      if (form.selectedApproverIds.length === 0) return setErr("Select an approver");
      selectedApproverIds = form.selectedApproverIds;
    } else if (eligibleApprovers.length === 1) selectedApproverIds = [eligibleApprovers[0].id];

    if (isProject) {
      const budget = getActiveBudgetForProject(budgets, form.projectId);
      if (!budget) return setErr("No active budget for this project. Raise a budget request first.");
      const projReqs = requests.filter(r => r.projectId === form.projectId && !["Rejected", "Cancelled"].includes(r.status));
      const projCommitted = projReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);
      const available = budget.amountINR - projCommitted;
      if (available - amountINR < 0) return setErr(`Exceeds project budget. Available: ₹${(available / 100000).toFixed(2)}L.`);
      if (!form.linkedPOId) return setErr("PO is mandatory for project payments. Select an approved PO.");
    }

    if (!isProject && selectedType) {
      if (!monthlyBudget) return setErr(`No active Monthly Budget for ${user.dept} → ${selectedType.name} for ${currentMonth}. Ask Dept Head to raise one first.`);
      if (amountINR > monthlyAvailable) return setErr(`Exceeds Monthly Budget pool. Available: ₹${(monthlyAvailable / 1000).toFixed(1)}K.`);
    }

    if (form.linkedPOId) {
      const po = pos.find(p => p.id === form.linkedPOId);
      if (!po) return setErr("Selected PO not found.");
      if (po.status === "Cancelled") return setErr("This PO has been cancelled.");
      const avail = getPOAvailable(po, requests);
      if (amountINR > avail) return setErr(`Exceeds PO available balance. PO ${po.poNumber} available: ₹${(avail / 100000).toFixed(2)}L.`);
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const initialStage = needsMid ? "BoxBuildMid" : "DeptApproval";
    const linkedPOInfo = form.linkedPOId ? pos.find(p => p.id === form.linkedPOId) : null;
    const newRequest = {
      id: "EXP-" + Date.now(), kind: "Payment", createdDate: now,
      requesterId: user.id, requesterName: user.name, requesterEmail: user.email, dept: user.dept,
      expenseTypeId: form.expenseTypeId, expenseTypeName: selectedType.name, category: selectedType.category,
      isProject, projectId: form.projectId, vendor: form.vendor, description: form.description, purpose: form.purpose,
      amount: parseFloat(form.amount), currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR,
      travelFrom: form.travelFrom, travelTo: form.travelTo, travelDates: form.travelDates,
      invoiceNumber: form.invoiceNumber, attachment: form.attachment,
      linkedPOId: form.linkedPOId || null, linkedPONumber: linkedPOInfo?.poNumber || null,
      selectedApprovers: selectedApproverIds,
      currentStage: initialStage, status: getStageLabel(initialStage),
      resubmittedFrom: resubmitFrom?.id || null,
      history: [
        ...(resubmitFrom ? [{ action: "Resubmitted", by: user.name, byId: user.id, at: now, comments: `From ${resubmitFrom.id}` }] : []),
        { action: "Submitted", by: user.name, byId: user.id, at: now, comments: "Payment request raised" + (linkedPOInfo ? ` against PO ${linkedPOInfo.poNumber}` : "") }
      ],
    };
    await saveRequests([newRequest, ...requests]);
    setSubmitting(false);
    onSuccess();
  }

  const flowSteps = [user.name];
  if (needsMid) flowSteps.push("Arun (Delivery Head)");
  if (isOdmProject) flowSteps.push("Shreya + Akash (both)");
  else if (isMultiApprover && form.selectedApproverIds.length > 0) flowSteps.push(form.selectedApproverIds.map(id => getRoster().find(u => u.id === id)?.name).filter(Boolean).join(" + "));
  else if (eligibleApprovers.length === 1) flowSteps.push(eligibleApprovers[0].name);
  else if (isMultiApprover) flowSteps.push("<select approver>");
  flowSteps.push("Ravi (Finance Head)");
  if (amountINR >= VP_THRESHOLD && amountINR < CEO_THRESHOLD) flowSteps.push("Mahendra (VP)");
  if (amountINR >= CEO_THRESHOLD) flowSteps.push("CEO");
  flowSteps.push("Divyanshu (Accountant)");

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      {resubmitFrom && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Resubmitting from {resubmitFrom.id}</div>
            <div className="text-xs text-amber-800 mt-0.5">Edit and resubmit. Original rejected request stays in audit log.</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">Raise Payment Request</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">For project expenses, both an approved Budget AND an approved PO are mandatory.</p>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
            <input value={user.dept} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expense Type *</label>
            <select value={form.expenseTypeId} onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value, selectedApproverIds: [], linkedPOId: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select type</option>
              {!NON_PROJECT_DEPTS.includes(user.dept) && (
                <optgroup label="Project Expenses (Budget + PO required)">
                  {EXPENSE_TYPES.filter(t => t.category === "Project").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              )}
              <optgroup label="Non-Project Expenses">
                {EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            </select>
            {NON_PROJECT_DEPTS.includes(user.dept) && <p className="text-xs text-slate-500 mt-1">{user.dept} cannot raise project expenses.</p>}
          </div>
        </div>

        {isProject && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project (must have approved budget) *</label>
            {activeBudgets.length === 0 ? (
              <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 inline mr-1" />No active project budgets.
              </div>
            ) : (
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, linkedPOId: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select project</option>
                {activeBudgets.map(b => {
                  const projReqs = requests.filter(r => r.projectId === b.projectId && !["Rejected", "Cancelled"].includes(r.status));
                  const committed = projReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);
                  const avail = b.amountINR - committed;
                  const tag = b.projectType === "RD" ? "[R&D] " : "[Client] ";
                  return <option key={b.projectId} value={b.projectId}>{tag}{b.projectId} — {b.projectName} (₹{(avail / 100000).toFixed(2)}L avail)</option>;
                })}
              </select>
            )}
          </div>
        )}

        {/* PO selection for project */}
        {isProject && form.projectId && (
          <div className={`rounded-lg p-3 border ${projectPOs.length === 0 ? "bg-red-50 border-red-200" : "bg-fuchsia-50 border-fuchsia-200"}`}>
            <label className="block text-xs font-bold text-fuchsia-900 mb-1.5">
              <FileSignature className="w-3.5 h-3.5 inline mr-1" />Linked PO * (mandatory for project payments)
            </label>
            {projectPOs.length === 0 ? (
              <div className="text-xs text-red-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />No approved POs for this project. Raise a PO Request first.
              </div>
            ) : (
              <>
                <select value={form.linkedPOId} onChange={(e) => setForm({ ...form, linkedPOId: e.target.value })} className="w-full px-3 py-2 border border-fuchsia-300 rounded-lg text-sm bg-white">
                  <option value="">Select an approved PO</option>
                  {projectPOs.map(po => {
                    const avail = getPOAvailable(po, requests);
                    const editing = hasPendingEdit(po.id) ? " ⚠ edit pending" : "";
                    return <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(avail / 100000).toFixed(2)}L avail of ₹{(po.amountINR / 100000).toFixed(2)}L){editing}</option>;
                  })}
                </select>
                {linkedPO && (
                  <div className="mt-2 text-xs text-fuchsia-800 bg-white rounded p-2 border border-fuchsia-200">
                    <div className="font-semibold">{linkedPO.poNumber} · {linkedPO.supplierName}</div>
                    <div>Approved: ₹{(linkedPO.amountINR / 100000).toFixed(2)}L · Used: ₹{(poUsage.total / 100000).toFixed(2)}L · Available: <strong className="text-emerald-700">₹{(poAvailable / 100000).toFixed(2)}L</strong></div>
                    {linkedPOHasPendingEdit && (
                      <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                        <Edit3 className="w-3 h-3 inline mr-1" /><strong>Edit Pending:</strong> An edit request is in approval. PO amount may change once approved. Payment is still allowed against current amount.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isProject && selectedType && deptPOs.length > 0 && (
          <div className="rounded-lg p-3 border bg-fuchsia-50 border-fuchsia-200">
            <label className="block text-xs font-bold text-fuchsia-900 mb-1.5">
              <FileSignature className="w-3.5 h-3.5 inline mr-1" />Link to PO (optional)
            </label>
            <select value={form.linkedPOId} onChange={(e) => setForm({ ...form, linkedPOId: e.target.value })} className="w-full px-3 py-2 border border-fuchsia-300 rounded-lg text-sm bg-white">
              <option value="">No PO (small payment via Monthly Budget pool)</option>
              {deptPOs.map(po => {
                const avail = getPOAvailable(po, requests);
                const editing = hasPendingEdit(po.id) ? " ⚠ edit pending" : "";
                return <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(avail / 100000).toFixed(2)}L avail){editing}</option>;
              })}
            </select>
            {linkedPO && (
              <div className="mt-2 text-xs text-fuchsia-800 bg-white rounded p-2 border border-fuchsia-200">
                <div className="font-semibold">{linkedPO.poNumber} · {linkedPO.supplierName}</div>
                <div>Approved: ₹{(linkedPO.amountINR / 100000).toFixed(2)}L · Available: <strong className="text-emerald-700">₹{(poAvailable / 100000).toFixed(2)}L</strong></div>
                <div className="mt-1 italic">Note: Will deduct from BOTH this PO and Monthly Budget pool.</div>
                {linkedPOHasPendingEdit && (
                  <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                    <Edit3 className="w-3 h-3 inline mr-1" /><strong>Edit Pending</strong> — amount may change.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isProject && selectedType && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purpose *</label>
              <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Quarterly team offsite" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            {monthlyBudget ? (
              <div className={`rounded-lg p-3 border ${amountINR > monthlyAvailable ? "bg-red-50 border-red-200" : monthlyUsage.total / monthlyBudget.amountINR > 0.8 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="w-4 h-4 text-slate-700" />
                  <div className="text-xs font-bold text-slate-900">📊 {user.dept} Monthly Pool — {selectedType.name}</div>
                </div>
                <div className="text-xs text-slate-700 mb-1">Approved by <strong>{monthlyBudget.approvedBy || monthlyBudget.requesterName}</strong> · Available to all {user.dept} members</div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(monthlyBudget.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Used</div><div className="font-bold">₹{(monthlyUsage.total / 1000).toFixed(1)}K</div></div>
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Available</div><div className="font-bold text-emerald-700">₹{(monthlyAvailable / 1000).toFixed(1)}K</div></div>
                </div>
                {amountINR > monthlyAvailable && <div className="text-xs text-red-700 font-semibold">⚠ Exceeds available budget. Ask Dept Head for an Extension.</div>}
              </div>
            ) : (
              <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900">No Monthly Budget Pool for this category</div>
                    <div className="text-amber-800 mt-0.5">{user.dept} doesn't have an active Monthly Budget for <strong>{selectedType.name}</strong> in {currentMonth}. Ask your Dept Head to raise one.</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {isTravel && (
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">From</label><input value={form.travelFrom} onChange={(e) => setForm({ ...form, travelFrom: e.target.value })} placeholder="Delhi" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">To</label><input value={form.travelTo} onChange={(e) => setForm({ ...form, travelTo: e.target.value })} placeholder="Bangalore" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Dates</label><input value={form.travelDates} onChange={(e) => setForm({ ...form, travelDates: e.target.value })} placeholder="15-18 May 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vendor / Payee</label>
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          {isVendorPayment && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Invoice Number</label>
              <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-2026-001" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description *</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this expense for?" rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>

        <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Amount" required />

        {isMultiApprover && !isOdmProject && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <label className="block text-xs font-semibold text-indigo-900 mb-2">Select Approver *</label>
            <div className="space-y-1.5">
              {eligibleApprovers.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer bg-white rounded px-3 py-2 border border-indigo-200 hover:bg-indigo-50">
                  <input type="radio" checked={form.selectedApproverIds.includes(a.id)} onChange={() => setForm({ ...form, selectedApproverIds: [a.id] })} className="w-4 h-4" />
                  <div><div className="text-sm font-semibold text-slate-900">{a.name}</div><div className="text-xs text-slate-500">{a.designation}</div></div>
                </label>
              ))}
            </div>
          </div>
        )}
        {isOdmProject && <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs font-semibold text-indigo-900">ODM Project requests need approval from BOTH Shreya and Akash.</div>}

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required />

        {amountINR > 0 && form.expenseTypeId && <FlowPreview steps={flowSteps} />}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : (resubmitFrom ? "Resubmit" : "Submit Payment Request")}</button>
        </div>
      </div>
    </div>
  );
}
