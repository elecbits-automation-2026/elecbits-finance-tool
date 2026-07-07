import { useState } from "react";
import { Edit3, FileSignature, Briefcase, Target, AlertTriangle, Plus, X, CheckCircle2, FileText, PencilLine } from "lucide-react";
import { CURRENCIES, EXPENSE_TYPES, NON_PROJECT_DEPTS, GSTIN_REGEX, GST_RATES, UNIT_OPTIONS, MAX_BUDGET_RATIO, VP_THRESHOLD, CEO_THRESHOLD } from "../constants";
import { isReadOnly } from "../lib/access";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, getStageLabel } from "../lib/workflow";
import { computeLineItemTotals, getActiveBudgetForProject, getActiveMonthlyBudget, getMonthlyBudgetUsage } from "../lib/finance";
import { AttachmentInput } from "../components/AttachmentInput";
import { FlowPreview } from "../components/FlowPreview";

// ============ NEW PO REQUEST FORM ============
export function NewPORequestForm({ user, budgets, pos, requests, suppliers = [], savePOs, saveSuppliers, onSuccess, editFor = null, reviseFrom = null }) {
  const isEdit = !!editFor;
  const [form, setForm] = useState<any>(isEdit ? {
    poNumber: "",
    isProject: editFor.isProject,
    projectId: editFor.projectId || "",
    category: editFor.category || "",
    supplierId: "",
    supplierName: editFor.supplierName,
    supplierAddress: editFor.supplierAddress,
    supplierGST: editFor.supplierGST || "",
    isInternational: editFor.isInternational || false,
    supplierCountry: editFor.supplierCountry || "",
    supplierTaxId: editFor.supplierTaxId || "",
    hasPI: editFor.hasPI || false,
    piNumber: editFor.piNumber || "",
    piSubtotal: editFor.piSubtotal != null ? String(editFor.piSubtotal) : "",
    piGstPct: editFor.piGstPct != null ? editFor.piGstPct : 18,
    lineItems: editFor.lineItems && editFor.lineItems.length > 0 ? JSON.parse(JSON.stringify(editFor.lineItems)) : [{ id: "L1", description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }],
    currency: editFor.currency || "INR",
    fxRate: editFor.fxRate || 1,
    scope: editFor.scope,
    deliveryTimeline: editFor.deliveryTimeline,
    paymentTerms: editFor.paymentTerms,
    attachment: null,
    editReason: "",
    changeNote: "",
    verified: false,
  } : reviseFrom ? {
    isProject: reviseFrom.isProject,
    projectId: reviseFrom.projectId || "", category: reviseFrom.category || "",
    supplierId: "",
    supplierName: reviseFrom.supplierName || "", supplierAddress: reviseFrom.supplierAddress || "", supplierGST: reviseFrom.supplierGST || "",
    isInternational: reviseFrom.isInternational || false, supplierCountry: reviseFrom.supplierCountry || "", supplierTaxId: reviseFrom.supplierTaxId || "",
    hasPI: reviseFrom.hasPI || false, piNumber: reviseFrom.piNumber || "", piSubtotal: reviseFrom.piSubtotal != null ? String(reviseFrom.piSubtotal) : "", piGstPct: reviseFrom.piGstPct != null ? reviseFrom.piGstPct : 18,
    lineItems: reviseFrom.lineItems && reviseFrom.lineItems.length ? JSON.parse(JSON.stringify(reviseFrom.lineItems)) : [{ id: "L1", description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }],
    currency: reviseFrom.currency || "INR", fxRate: reviseFrom.fxRate || 1,
    scope: reviseFrom.scope || "", deliveryTimeline: reviseFrom.deliveryTimeline || "", paymentTerms: reviseFrom.paymentTerms || "Net 30",
    attachment: null,
    verified: false,
  } : {
    isProject: !NON_PROJECT_DEPTS.includes(user.dept),
    projectId: "", category: "",
    supplierId: "",
    supplierName: "", supplierAddress: "", supplierGST: "",
    isInternational: false, supplierCountry: "", supplierTaxId: "",
    hasPI: false, piNumber: "", piSubtotal: "", piGstPct: 18,
    lineItems: [{ id: "L1", description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }],
    currency: "INR", fxRate: 1,
    scope: "", deliveryTimeline: "", paymentTerms: "Net 30",
    attachment: null,
    verified: false,
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Track whether the user has edited any autofilled supplier fields.
  // When true, the form treats the entry as a new supplier even if supplierId is set.
  const [supplierEdited, setSupplierEdited] = useState(false);

  // A supplier is "from the master" if one was selected and not subsequently edited.
  const supplierFromMaster = !!form.supplierId && !supplierEdited;

  // A Proforma Invoice carries a single total amount (GST inclusive), not a
  // subtotal + GST breakdown. The two amount paths are mutually exclusive.
  const piTotalNum = parseFloat(form.piSubtotal || 0);
  const piTotals = { subtotal: piTotalNum, totalGST: 0, grandTotal: piTotalNum };
  const lineTotals = computeLineItemTotals(form.lineItems);
  const totals = form.hasPI ? piTotals : lineTotals;
  const grandTotalINR = form.currency === "INR" ? totals.grandTotal : totals.grandTotal * parseFloat(form.fxRate || 0);
  const subtotalINR = form.currency === "INR" ? totals.subtotal : totals.subtotal * parseFloat(form.fxRate || 0);
  const gstINR = form.currency === "INR" ? totals.totalGST : totals.totalGST * parseFloat(form.fxRate || 0);

  const activeBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBudget = (!form.isProject && form.category && !isEdit) ? getActiveMonthlyBudget(budgets, user.dept, form.category, currentMonth) : null;
  const monthlyUsage = monthlyBudget ? getMonthlyBudgetUsage(requests, user.dept, form.category, currentMonth) : null;
  const monthlyAvailable = monthlyBudget ? Math.max(0, monthlyBudget.amountINR - monthlyUsage.total) : 0;
  const eligibleApprovers = getEligibleDeptApprovers(user, { requiresProject: form.isProject, category: form.isProject ? "Project" : "Non-Project" }, form.isProject);
  const needsMid = needsBoxBuildMidApproval(user);
  const canRaiseProjectPO = !NON_PROJECT_DEPTS.includes(user.dept);

  // Pick a supplier from the master: autofill name/address/GSTIN.
  // Fields remain editable — if the user changes anything, supplierEdited flips
  // to true and the entry is saved as a new supplier on submit.
  function selectSupplier(id) {
    setSupplierEdited(false);
    if (!id) { setForm({ ...form, supplierId: "" }); return; }
    const s = suppliers.find(x => x.id === id);
    if (!s) { setForm({ ...form, supplierId: "" }); return; }
    setForm({
      ...form, supplierId: id,
      supplierName: s.name || "",
      supplierAddress: s.address || "",
      supplierGST: s.gstin || "",
      isInternational: !!s.isInternational,
      supplierCountry: s.country || "",
      supplierTaxId: s.taxId || "",
    });
  }

  // Helper: update a supplier field and mark it as edited (so it saves as new).
  function updateSupplierField(field: string, value: any) {
    if (form.supplierId) setSupplierEdited(true);
    setForm({ ...form, [field]: value });
  }

  function addLineItem() {
    const newId = "L" + (form.lineItems.length + 1) + "-" + Date.now().toString(36);
    setForm({ ...form, lineItems: [...form.lineItems, { id: newId, description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }] });
  }
  function removeLineItem(id) {
    if (form.lineItems.length === 1) { setErr("At least 1 line item required"); return; }
    setForm({ ...form, lineItems: form.lineItems.filter(li => li.id !== id), verified: false });
  }
  function updateLineItem(id, field, value) {
    setForm({ ...form, lineItems: form.lineItems.map(li => li.id === id ? { ...li, [field]: value } : li), verified: false });
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); setErr(""); };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (isReadOnly(user)) return setErr("Your account is read-only and cannot raise requests.");
    if (!user.dept) return setErr("Your account has no department assigned. Ask an admin to set your department before raising requests.");
    if (form.isProject && !form.projectId) return setErr("Select project");
    if (!form.isProject && !form.category) return setErr("Select category");
    if (!form.supplierName.trim()) return setErr("Supplier name required");
    if (!form.supplierAddress.trim()) return setErr("Supplier address required");

    // GSTIN validation
    if (!form.isInternational) {
      if (!form.supplierGST.trim()) return setErr("GSTIN required for Indian suppliers (or check 'International supplier' if not applicable)");
      if (!GSTIN_REGEX.test(form.supplierGST.trim().toUpperCase())) return setErr("Invalid GSTIN format. Expected 15 chars like 09AABCA1234A1ZP");
    } else {
      if (!form.supplierCountry.trim()) return setErr("Country required for international supplier");
    }

    // Amount source: PI figures OR line items (mutually exclusive).
    if (form.hasPI) {
      if (!form.piSubtotal || parseFloat(form.piSubtotal) <= 0) return setErr("PI total amount must be > 0");
    } else {
      if (!form.lineItems || form.lineItems.length === 0) return setErr("At least 1 line item required");
      for (let i = 0; i < form.lineItems.length; i++) {
        const li = form.lineItems[i];
        if (!li.description.trim()) return setErr(`Line ${i + 1}: description required`);
        if (!li.qty || parseFloat(li.qty) <= 0) return setErr(`Line ${i + 1}: qty must be > 0`);
        if (!li.unitCost || parseFloat(li.unitCost) <= 0) return setErr(`Line ${i + 1}: unit cost must be > 0`);
      }
    }

    if (totals.grandTotal <= 0) return setErr("Grand total must be > 0");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");

    if (!form.scope.trim()) return setErr("Scope required");
    if (!form.deliveryTimeline.trim()) return setErr("Delivery timeline required");
    if (!form.paymentTerms.trim()) return setErr("Payment terms required");

    if (!form.verified) return setErr("Please verify the totals are correct (checkbox below)");

    if (isEdit) {
      if (!form.poNumber.trim()) return setErr("PO number reference required");
      if (form.poNumber !== editFor.poNumber) return setErr(`PO number must match: ${editFor.poNumber}`);
      if (!form.editReason.trim()) return setErr("Reason for edit required");
      if (!form.changeNote.trim()) return setErr("What's changing — required");

      if (form.isProject && form.projectId && grandTotalINR > editFor.amountINR) {
        const budget = getActiveBudgetForProject(budgets, form.projectId);
        if (budget) {
          const otherProjectPOs = pos.filter(p => p.type === "POCreate" && p.projectId === form.projectId && p.id !== editFor.id && !["Rejected", "Cancelled"].includes(p.status));
          const otherPOAmount = otherProjectPOs.reduce((s, p) => s + p.amountINR, 0);
          const totalAfter = otherPOAmount + grandTotalINR;
          if (totalAfter > budget.amountINR) {
            const overBy = totalAfter - budget.amountINR;
            return setErr(`Edit pushes total POs to ₹${(totalAfter / 100000).toFixed(2)}L, exceeding budget of ₹${(budget.amountINR / 100000).toFixed(2)}L by ₹${(overBy / 100000).toFixed(2)}L. Raise a Budget Extension first.`);
          }
          if (budget.projectType === "Client" && budget.clientOrderValue > 0) {
            const ceiling = budget.clientOrderValue * MAX_BUDGET_RATIO;
            if (totalAfter > ceiling) return setErr(`Breaches 20% margin. Max PO commitments: ₹${(ceiling / 100000).toFixed(2)}L (80% of client order ₹${(budget.clientOrderValue / 100000).toFixed(2)}L).`);
          }
        }
      }
    }

    if (form.isProject && !isEdit) {
      const budget = getActiveBudgetForProject(budgets, form.projectId);
      if (!budget) return setErr("Selected project has no active budget.");
      // A new PO's commitment (plus already-approved POs on the project) may not exceed
      // the project budget — mirrors the edit-PO ceiling so a PO can't be born over budget.
      // Count approved AND in-flight (pending) POs — otherwise several pending POs could
      // each pass under budget but collectively blow past it once all are approved.
      const otherProjectPOs = pos.filter(p => p.type === "POCreate" && p.projectId === form.projectId && !["Rejected", "Cancelled"].includes(p.status));
      const otherPOAmount = otherProjectPOs.reduce((s, p) => s + p.amountINR, 0);
      const totalAfter = otherPOAmount + grandTotalINR;
      if (totalAfter > budget.amountINR) {
        const overBy = totalAfter - budget.amountINR;
        return setErr(`PO commitments (approved + in-flight) would total ₹${(totalAfter / 100000).toFixed(2)}L, exceeding the project budget of ₹${(budget.amountINR / 100000).toFixed(2)}L by ₹${(overBy / 100000).toFixed(2)}L. Raise a Budget Extension first.`);
      }
      if (budget.projectType === "Client" && budget.clientOrderValue > 0) {
        const ceiling = budget.clientOrderValue * MAX_BUDGET_RATIO;
        if (totalAfter > ceiling) return setErr(`Breaches 20% margin. Max PO commitments: ₹${(ceiling / 100000).toFixed(2)}L (80% of client order ₹${(budget.clientOrderValue / 100000).toFixed(2)}L).`);
      }
    }
    if (!form.isProject && !isEdit) {
      if (!monthlyBudget) return setErr(`No active Monthly Budget for ${user.dept} → ${form.category} for ${currentMonth}. Ask your Dept Head to raise one before raising this PO.`);
    }
    if (!form.attachment && !isEdit) return setErr(form.hasPI ? "Proforma Invoice (PI) document mandatory" : "Vendor quote mandatory");

    setSubmitting(true);
    const now = new Date().toISOString();
    const selectedApproverIds = eligibleApprovers.map(a => a.id);

    // Save to the supplier master when:
    //   a) no supplier was selected (brand new), OR
    //   b) a supplier was selected but the user edited the details (save as new entry)
    // Never overwrite an existing master entry — always insert a new one.
    const isNewEntry = !form.supplierId || supplierEdited;
    if (isNewEntry && saveSuppliers && form.supplierName.trim()) {
      const nameKey = form.supplierName.trim().toLowerCase();
      const gstKey = (form.supplierGST || "").trim().toUpperCase();
      // Only skip if an entry with the exact same name AND GSTIN already exists.
      const exists = suppliers.some(s =>
        (s.name || "").trim().toLowerCase() === nameKey &&
        (gstKey ? (s.gstin || "").trim().toUpperCase() === gstKey : true)
      );
      if (!exists) {
        const newSupplier = {
          id: "SUP-" + Date.now(),
          name: form.supplierName.trim(),
          address: form.supplierAddress.trim(),
          gstin: form.isInternational ? "" : gstKey,
          isInternational: !!form.isInternational,
          country: form.supplierCountry.trim(),
          taxId: form.supplierTaxId.trim(),
          createdBy: user.id, createdByName: user.name, createdAt: now,
        };
        await saveSuppliers([newSupplier, ...suppliers]);
      }
    }

    const baseData = {
      isProject: form.isProject, projectId: form.projectId, category: form.category,
      supplierName: form.supplierName, supplierAddress: form.supplierAddress,
      supplierGST: form.supplierGST.trim().toUpperCase(),
      isInternational: form.isInternational, supplierCountry: form.supplierCountry, supplierTaxId: form.supplierTaxId,
      hasPI: !!form.hasPI,
      piNumber: form.hasPI ? form.piNumber.trim() : "",
      piSubtotal: form.hasPI ? piTotalNum : undefined,
      piGstPct: undefined,
      lineItems: form.hasPI ? [] : JSON.parse(JSON.stringify(form.lineItems)),
      subtotal: totals.subtotal, totalGST: totals.totalGST,
      amount: totals.grandTotal, currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR: grandTotalINR,
      scope: form.scope, deliveryTimeline: form.deliveryTimeline, paymentTerms: form.paymentTerms,
      attachment: form.attachment,
    };

    if (isEdit) {
      const editRequest = {
        id: "POEDIT-" + Date.now(), kind: "PO", type: "POEdit",
        editingPOId: editFor.id, editingPONumber: editFor.poNumber,
        createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
        ...baseData,
        editReason: form.editReason, changeNote: form.changeNote,
        currentStage: needsMid && user.dept === "Box Build" && user.role === "Employee" ? "BoxBuildMid" : "DeptApproval",
        status: getStageLabel("DeptApproval", "PO"),
        selectedApprovers: selectedApproverIds,
        history: [{ action: "Edit Submitted", by: user.name, byId: user.id, at: now, comments: `Edit for ${editFor.poNumber}: ${form.changeNote}` }],
      };
      await savePOs([editRequest, ...pos]);
    } else {
      const initialStage = needsMid ? "BoxBuildMid" : "DeptApproval";
      const newPO = {
        id: "PO-REQ-" + Date.now(), kind: "PO", type: "POCreate",
        createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
        ...baseData,
        currentStage: initialStage, status: getStageLabel(initialStage, "PO"),
        selectedApprovers: selectedApproverIds, version: 1, editHistory: [],
        revisedFrom: reviseFrom?.id || null,
        revisionNote: reviseFrom ? (reviseFrom.returnRemarks || "") : "",
        revisionRound: reviseFrom ? (reviseFrom.revisionRound || 0) + 1 : 0,
        history: [{ action: "Submitted", by: user.name, byId: user.id, at: now, comments: reviseFrom ? "PO re-sent after return for changes" : "PO request raised" }],
      };
      await savePOs([newPO, ...pos]);
    }
    setSubmitting(false);
    onSuccess();
  }

  const flowSteps = [user.name];
  if (needsMid) flowSteps.push("Arun (Delivery Head)");
  flowSteps.push(eligibleApprovers.map(a => a.name).filter(Boolean).join(" / ") || "Dept Head");
  flowSteps.push("Finance Head");
  if (!isEdit) {
    if (grandTotalINR >= VP_THRESHOLD && grandTotalINR < CEO_THRESHOLD) flowSteps.push("VP");
    if (grandTotalINR >= CEO_THRESHOLD) flowSteps.push("VP + Stuti & Sarthak");
  }
  flowSteps.push("Accountant (assigns PO #)");

  const currencySymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol || "₹";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
      {isEdit && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Edit3 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Editing PO {editFor.poNumber} (v{editFor.version || 1})</div>
            <div className="text-xs text-amber-800 mt-0.5">Approval: Dept Head → Finance Head → Accountant. New version will be created.</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <FileSignature className="w-5 h-5 text-fuchsia-600" />
        <h2 className="text-xl font-bold text-slate-900">{isEdit ? "Edit PO Request" : "Raise PO Request"}</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">{isEdit ? "Edit existing PO. PO amount auto-calculated from line items." : "PO is raised for one supplier. Amount auto-calculated from line items."}</p>

      <div className="space-y-4">
        {isEdit && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">PO Number Reference *</label>
            <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} placeholder={`Type ${editFor.poNumber}`} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
          </div>
        )}

        {!isEdit && canRaiseProjectPO && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setForm({ ...form, isProject: true, category: "" })} className={`px-3 py-2.5 rounded-lg text-sm font-semibold border ${form.isProject ? "bg-fuchsia-600 text-white border-fuchsia-600" : "bg-white border-slate-200 text-slate-700"}`}><Briefcase className="w-4 h-4 inline mr-1" />For Project</button>
            <button onClick={() => setForm({ ...form, isProject: false, projectId: "" })} className={`px-3 py-2.5 rounded-lg text-sm font-semibold border ${!form.isProject ? "bg-fuchsia-600 text-white border-fuchsia-600" : "bg-white border-slate-200 text-slate-700"}`}><Target className="w-4 h-4 inline mr-1" />Department (Non-Project)</button>
          </div>
        )}
        {!isEdit && !canRaiseProjectPO && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900"><strong>{user.dept}</strong> can only raise non-project POs.</div>
        )}

        {form.isProject && !isEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project *</label>
            {activeBudgets.length === 0 ? (
              <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900"><AlertTriangle className="w-4 h-4 inline mr-1" />No active project budgets.</div>
            ) : (
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select project</option>
                {activeBudgets.map(b => <option key={b.projectId} value={b.projectId}>[{b.projectType === "RD" ? "R&D" : b.projectType === "OneTime" ? "One-Time" : "Client"}] {b.projectId} — {b.projectName}</option>)}
              </select>
            )}
          </div>
        )}

        {!form.isProject && !isEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select</option>
              {EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        )}

        {!form.isProject && !isEdit && form.category && (
          monthlyBudget ? (
            <div className={`rounded-lg p-3 border ${grandTotalINR > monthlyAvailable && grandTotalINR > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="text-xs font-bold text-slate-900 mb-1.5">📊 {user.dept} Monthly Budget — {form.category} ({currentMonth})</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded p-1.5"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(monthlyBudget.amountINR / 1000).toFixed(1)}K</div></div>
                <div className="bg-white rounded p-1.5"><div className="text-slate-500">Used</div><div className="font-bold">₹{(monthlyUsage.total / 1000).toFixed(1)}K</div></div>
                <div className="bg-white rounded p-1.5"><div className="text-slate-500">Available</div><div className="font-bold text-emerald-700">₹{(monthlyAvailable / 1000).toFixed(1)}K</div></div>
              </div>
              {grandTotalINR > monthlyAvailable && grandTotalINR > 0 && <div className="text-xs text-amber-700 font-semibold mt-1.5">⚠ This PO (₹{(grandTotalINR / 1000).toFixed(1)}K) exceeds the available pool. It can still be raised, but consider a Budget Extension.</div>}
            </div>
          ) : (
            <div className="rounded-lg p-3 border bg-amber-50 border-amber-200 text-xs">
              <div className="font-bold text-amber-900"><AlertTriangle className="w-4 h-4 inline mr-1" />No Monthly Budget for {form.category}</div>
              <div className="text-amber-800 mt-0.5">{user.dept} has no active Monthly Budget for <strong>{form.category}</strong> in {currentMonth}. Ask your Dept Head to raise one before raising this PO.</div>
            </div>
          )
        )}

        {/* Supplier Details */}
        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs font-bold text-fuchsia-900"><Briefcase className="w-3.5 h-3.5 inline mr-1" />Supplier Details</div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-900 cursor-pointer">
              <input type="checkbox" checked={form.isInternational} onChange={(e) => updateSupplierField("isInternational", e.target.checked)} className="w-3.5 h-3.5" />
              International supplier (no GSTIN)
            </label>
          </div>

          {/* Pick from saved suppliers (autofills but stays editable) */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Saved Supplier</label>
            <select value={form.supplierId} onChange={(e) => selectSupplier(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">{suppliers.length === 0 ? "No saved suppliers yet — enter manually below" : "— Enter manually (new supplier) —"}</option>
              {suppliers.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.gstin ? ` · ${s.gstin}` : s.isInternational ? " · Intl" : ""}</option>
              ))}
            </select>

            {/* Contextual hint depending on state */}
            {supplierFromMaster && (
              <p className="text-xs text-fuchsia-700 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                Autofilled from saved supplier — you can edit any field below if needed.
              </p>
            )}
            {form.supplierId && supplierEdited && (
              <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <PencilLine className="w-3 h-3 shrink-0" />
                Details edited — will be saved as a new supplier entry on submit.
              </p>
            )}
            {!form.supplierId && form.supplierName.trim() && (
              <p className="text-xs text-slate-500 mt-1">New supplier — will be saved for next time.</p>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label>
              <input
                value={form.supplierName}
                onChange={(e) => updateSupplierField("supplierName", e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
              <textarea
                value={form.supplierAddress}
                onChange={(e) => updateSupplierField("supplierAddress", e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            {!form.isInternational ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN * <span className="font-normal text-slate-500">(15 chars, e.g. 09AABCA1234A1ZP)</span></label>
                <input
                  value={form.supplierGST}
                  onChange={(e) => updateSupplierField("supplierGST", e.target.value.toUpperCase())}
                  placeholder="09AABCA1234A1ZP"
                  className={`w-full px-3 py-1.5 border rounded-lg text-sm font-mono ${form.supplierGST && !GSTIN_REGEX.test(form.supplierGST.trim()) ? "border-red-300 bg-red-50" : "border-slate-300"}`}
                  maxLength={15}
                />
                {form.supplierGST && !GSTIN_REGEX.test(form.supplierGST.trim()) && <p className="text-xs text-red-600 mt-1">Invalid GSTIN format</p>}
                {form.supplierGST && GSTIN_REGEX.test(form.supplierGST.trim()) && <p className="text-xs text-emerald-600 mt-1"><CheckCircle2 className="w-3 h-3 inline" /> Valid GSTIN</p>}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country *</label>
                  <input
                    value={form.supplierCountry}
                    onChange={(e) => updateSupplierField("supplierCountry", e.target.value)}
                    placeholder="e.g. USA, Singapore"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tax ID / VAT (optional)</label>
                  <input
                    value={form.supplierTaxId}
                    onChange={(e) => updateSupplierField("supplierTaxId", e.target.value)}
                    placeholder="EIN / VAT / TIN"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Proforma Invoice toggle */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hasPI} onChange={(e) => setForm({ ...form, hasPI: e.target.checked, verified: false })} className="w-4 h-4 mt-0.5" />
            <span>
              <span className="text-xs font-bold text-teal-900"><FileText className="w-3.5 h-3.5 inline mr-1" />I have a Vendor Proforma Invoice for this PO <span className="font-normal text-teal-600">(payable — we pay the vendor)</span></span>
              <span className="block text-xs text-teal-700 mt-0.5">Tick this if you already have a PI from the supplier. You won't need to fill the line-items table — just enter the PI totals below and attach the PI document.</span>
            </span>
          </label>
          {form.hasPI && (
            <div className="mt-3 space-y-2">
              <div className="grid md:grid-cols-2 gap-2">
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">PI Number (optional)</label><input value={form.piNumber} onChange={(e) => setForm({ ...form, piNumber: e.target.value })} placeholder="PI / Invoice ref" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount *</label><input type="number" value={form.piSubtotal} onChange={(e) => setForm({ ...form, piSubtotal: e.target.value, verified: false })} placeholder={currencySymbol} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="bg-white border border-teal-200 rounded p-2 text-xs">
                <span className="text-teal-900">Total Amount: <strong>{currencySymbol}{piTotals.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>{form.currency !== "INR" && ` (≈ ₹${grandTotalINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })})`}</span>
              </div>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className={`bg-purple-50 border border-purple-200 rounded-lg p-3 ${form.hasPI ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs font-bold text-purple-900">📋 Line Items {form.hasPI ? <span className="font-normal text-purple-600">(disabled — using PI totals)</span> : "*"}</div>
            <div className="flex items-center gap-2">
              <select value={form.currency} onChange={(e) => {
                const newCurr = e.target.value;
                const newRate = CURRENCIES.find(c => c.code === newCurr)?.defaultRate || 1;
                setForm({ ...form, currency: newCurr, fxRate: newCurr === "INR" ? 1 : newRate, verified: false });
              }} className="text-xs px-2 py-1 border border-purple-300 rounded-lg">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button onClick={addLineItem} disabled={form.hasPI} className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"><Plus className="w-3 h-3" />Add Line</button>
            </div>
          </div>
          {form.currency !== "INR" && (
            <div className="mb-2 grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-slate-600 mb-0.5">FX Rate (1 {form.currency} = ? INR)</label><input type="number" step="0.01" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value, verified: false })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" /></div>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5 text-xs"><span className="text-emerald-700">Grand Total in INR:</span> <strong className="text-emerald-900">₹{grandTotalINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
            </div>
          )}
          {form.hasPI ? (
            <div className="text-xs text-purple-700 italic bg-white/60 border border-dashed border-purple-300 rounded p-3 text-center">
              Line items aren't used for this PO — the total is taken from the Proforma Invoice above.
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-600 font-semibold border-b border-purple-200">
                  <th className="p-1 w-8">#</th>
                  <th className="p-1">Description</th>
                  <th className="p-1 w-16">Qty</th>
                  <th className="p-1 w-20">Unit</th>
                  <th className="p-1 w-24">Unit Cost</th>
                  <th className="p-1 w-16">GST %</th>
                  <th className="p-1 w-24 text-right">Line Total</th>
                  <th className="p-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.lineItems.map((li, idx) => {
                  const lineSubtotal = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                  const lineGST = lineSubtotal * (parseFloat(li.gstPct || 0) / 100);
                  const lineTotal = lineSubtotal + lineGST;
                  return (
                    <tr key={li.id} className="border-b border-purple-100 last:border-0">
                      <td className="p-1 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-1"><input value={li.description} onChange={(e) => updateLineItem(li.id, "description", e.target.value)} placeholder="Item description" className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs" /></td>
                      <td className="p-1"><input type="number" value={li.qty} onChange={(e) => updateLineItem(li.id, "qty", e.target.value)} className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs" /></td>
                      <td className="p-1">
                        <select value={li.unit} onChange={(e) => updateLineItem(li.id, "unit", e.target.value)} className="w-full px-1 py-1 border border-slate-300 rounded text-xs">
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="p-1"><input type="number" value={li.unitCost} onChange={(e) => updateLineItem(li.id, "unitCost", e.target.value)} placeholder={currencySymbol} className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs" /></td>
                      <td className="p-1">
                        <select value={li.gstPct} onChange={(e) => updateLineItem(li.id, "gstPct", parseFloat(e.target.value))} className="w-full px-1 py-1 border border-slate-300 rounded text-xs">
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="p-1 text-right font-semibold text-slate-900">{currencySymbol}{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="p-1 text-center">
                        {form.lineItems.length > 1 && <button onClick={() => removeLineItem(li.id)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X className="w-3 h-3" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-purple-300">
                  <td colSpan={6} className="p-1.5 text-right font-semibold text-slate-700">Subtotal (excl GST):</td>
                  <td className="p-1.5 text-right font-bold text-slate-900">{currencySymbol}{totals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="p-1.5 text-right font-semibold text-slate-700">Total GST:</td>
                  <td className="p-1.5 text-right font-bold text-slate-900">{currencySymbol}{totals.totalGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                <tr className="bg-purple-100">
                  <td colSpan={6} className="p-1.5 text-right font-bold text-purple-900">GRAND TOTAL (incl GST):</td>
                  <td className="p-1.5 text-right font-bold text-purple-900 text-sm">{currencySymbol}{totals.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>

        <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Scope Summary *</label><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={2} placeholder="Brief overall scope (separate from line items)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Delivery *</label><input value={form.deliveryTimeline} onChange={(e) => setForm({ ...form, deliveryTimeline: e.target.value })} placeholder="e.g. 4 weeks" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Terms *</label>
            <select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option>Advance 100%</option><option>Advance 50% / Balance on Delivery</option><option>Advance 30% / Balance on Delivery</option><option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>On Delivery</option><option>Custom</option>
            </select>
          </div>
        </div>

        {isEdit && (
          <>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for Edit *</label><input value={form.editReason} onChange={(e) => setForm({ ...form, editReason: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">What's Changing? *</label><textarea value={form.changeNote} onChange={(e) => setForm({ ...form, changeNote: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </>
        )}

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required={!isEdit} label={isEdit ? "Updated Quote / PI (optional)" : form.hasPI ? "Proforma Invoice (PI) Document" : "Vendor Quote / Supporting Doc"} />

        {/* Verify Total checkbox */}
        {totals.grandTotal > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <div className="text-sm font-bold text-amber-900 mb-2">⚠ Please verify the totals before submitting</div>
            <div className="text-xs text-amber-800 mb-3 space-y-0.5">
              <div>{form.hasPI ? `From Proforma Invoice${form.piNumber ? ` ${form.piNumber}` : ""}` : `${form.lineItems.length} line item${form.lineItems.length !== 1 ? "s" : ""}`}</div>
              {!form.hasPI && <div>Subtotal (excl GST): <strong>{currencySymbol}{totals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>}
              {!form.hasPI && <div>+ GST: <strong>{currencySymbol}{totals.totalGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>}
              <div className="text-base pt-1 border-t border-amber-300 mt-1">= <strong>{form.hasPI ? "Total Amount" : "Grand Total"}: {currencySymbol}{totals.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>{form.currency !== "INR" && ` (≈ ₹${grandTotalINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })})`}</div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="w-4 h-4 mt-0.5" />
              <span className="text-xs font-semibold text-amber-900">{form.hasPI ? "I have verified the Proforma Invoice total amount is correct." : "I have verified all line items, quantities, unit costs, and GST rates are correct."}</span>
            </label>
          </div>
        )}

        {grandTotalINR > 0 && <FlowPreview steps={flowSteps} />}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting || !form.verified} className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : (isEdit ? "Submit Edit Request" : "Submit PO Request")}</button>
          {!form.verified && totals.grandTotal > 0 && <span className="text-xs text-amber-700 self-center">⬆ Tick the verification checkbox above to enable submit.</span>}
        </div>
      </div>
    </div>
  );
}