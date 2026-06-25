import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Send, Upload, X, Undo2, CheckSquare, FileSignature, Paperclip } from "lucide-react";
import { getStageLabel, computeNextStage, getDeptHeadsForDept } from "../lib/workflow";
import { getRoster } from "../lib/roster";
import { formatPONumber, formatPINumber, getPOUsage } from "../lib/finance";

// ============ ACTION BUTTONS ============
export function ActionButtons({ request, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter, savePICounter, poCounter, piCounter, addNotifications, showToast }) {
  const [mode, setMode] = useState(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ utr: "", paymentMode: "Bank Transfer", paymentDate: new Date().toISOString().slice(0, 10), proofAttachment: null, invoiceAttachment: null, note: "" });
  const [poNumberInput, setPONumberInput] = useState("");
  const [poAttachment, setPOAttachment] = useState<{ name: string; size: number; type: string; data: any; uploadedAt: string } | null>(null);

  const isBudget = request.kind === "Budget";
  const isPO = request.kind === "PO";
  const isPI = request.kind === "PI";
  // A PI flows through the exact same pipeline as a PO; these aliases let the shared
  // logic below stay kind-agnostic while still using the right counter, number format,
  // field names and labels for each document type.
  const isPOorPI = isPO || isPI;
  const reqKind = isBudget ? "Budget" : isPO ? "PO" : isPI ? "PI" : "Payment";
  const docLabel = isPI ? "PI" : "PO";
  const docCounter = isPI ? piCounter : poCounter;
  const saveDocCounter = isPI ? savePICounter : savePOCounter;
  const formatDocNumber = isPI ? formatPINumber : formatPONumber;
  const docNumberField = isPI ? "piNumber" : "poNumber";
  const isDocEdit = request.type === "POEdit" || request.type === "PIEdit";
  const isDocCancel = request.type === "POCancel" || request.type === "PICancel";
  const editingDocId = isPI ? request.editingPIId : request.editingPOId;
  const editingDocNumber = isPI ? request.editingPINumber : request.editingPONumber;
  const cancellingDocId = isPI ? request.cancellingPIId : request.cancellingPOId;
  const cancellingDocNumber = isPI ? request.cancellingPINumber : request.cancellingPONumber;
  const docNumberOf = (doc) => (isPI ? doc.piNumber : doc.poNumber);

  const isSuperManager = user.role === "SuperManager";
  const isPOAtSuperStage = isPOorPI && request.currentStage === "SuperManagerApproval";
  // FinanceHead is a MID-chain stage now (Finance reviews first, before VP/CEO), so the
  // SuperManager fast-track below must fire there too — the budgets_guard trigger expects
  // ANY SuperManager approval to jump straight to Active. Only the terminal processing
  // stages are excluded.
  const isEarlyStage = !["Accountant", "Processing"].includes(request.currentStage);

  async function handlePaymentProofUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPaymentForm({ ...paymentForm, proofAttachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); };
    reader.readAsDataURL(file);
  }

  async function handlePaymentInvoiceUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPaymentForm({ ...paymentForm, invoiceAttachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); };
    reader.readAsDataURL(file);
  }

  async function handlePOAttachmentUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPOAttachment({ name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() });
    };
    reader.readAsDataURL(file);
  }

  function resetPOAssignForm() {
    setMode(null);
    setComments("");
    setPONumberInput("");
    setPOAttachment(null);
  }

  async function doAction(actionType) {
    if (actionType === "reject" && !comments.trim()) { alert("Reason mandatory"); return; }
    if (actionType === "pay" && !paymentForm.invoiceAttachment && !paymentForm.proofAttachment) { alert("Attach an invoice or payment-done document before marking this paid."); return; }
    // PO/PI create at the accountant step must carry the signed/stamped document.
    if (actionType === "approve" && isPOorPI && request.currentStage === "Accountant" && !isDocEdit && !isDocCancel && !poAttachment) { alert(`Attach the signed / stamped ${docLabel} document before assigning the number.`); return; }
    setBusy(true);
    const now = new Date().toISOString();
    let actionLabel = "";
    let newStage = request.currentStage;
    let newStatus = request.status;
    let extraUpdates: any = {};

    if (actionType === "approve") {
      // Super manager override (but not for PO at SuperManagerApproval — that's their actual stage)
      if (isSuperManager && isEarlyStage && !isPOAtSuperStage) {
        actionLabel = `Approved by ${user.name}`;
        if (isBudget) { newStage = "Active"; newStatus = "Active"; }
        else if (isPOorPI) { newStage = "Accountant"; newStatus = getStageLabel("Accountant", reqKind); }
        else { newStage = "Accountant"; newStatus = getStageLabel("Accountant", "Payment"); }
      } else {
        const stageName = {
          "BoxBuildMid": "Approved by Delivery Head",
          "DeptApproval": "Approved (Dept)",
          "VP": "Approved by VP",
          "CEO": "Approved by CEO",
          "SuperManagerApproval": `Approved by ${user.name}`,
          "FinanceHead": "Approved by Finance Head",
          "Accountant": isPOorPI ? (isDocEdit ? "Edit Applied" : isDocCancel ? "Cancellation Applied" : `${docLabel} Number Assigned`) : "Processing",
        }[request.currentStage] || "Approved";
        actionLabel = stageName;

        // PO/PI Accountant stage — special handling for create/edit/cancel
        if (isPOorPI && request.currentStage === "Accountant") {
          if (isDocEdit) {
            const originalPO = pos_all.find(p => p.id === editingDocId);
            if (originalPO) {
              const newVersion = (originalPO.version || 1) + 1;
              const updatedPO = {
                ...originalPO,
                supplierName: request.supplierName, supplierAddress: request.supplierAddress, supplierGST: request.supplierGST,
                isInternational: request.isInternational, supplierCountry: request.supplierCountry, supplierTaxId: request.supplierTaxId,
                lineItems: request.lineItems ? JSON.parse(JSON.stringify(request.lineItems)) : originalPO.lineItems,
                subtotal: request.subtotal, totalGST: request.totalGST,
                amount: request.amount, currency: request.currency, fxRate: request.fxRate, amountINR: request.amountINR,
                scope: request.scope, deliveryTimeline: request.deliveryTimeline, paymentTerms: request.paymentTerms,
                version: newVersion,
                editHistory: [...(originalPO.editHistory || []), { version: newVersion, by: request.requesterName, at: now, changeNote: request.changeNote, reason: request.editReason }],
                history: [...(originalPO.history || []), { action: `Updated to v${newVersion}`, by: user.name, byId: user.id, at: now, comments: `Edit ${request.id} applied: ${request.changeNote}` }],
              };
              const editApproved = { ...request, currentStage: "Approved", status: "Approved", approvedBy: `${user.name} (${user.designation})`, approvedDate: now, history: [...request.history, { action: actionLabel, by: user.name, byId: user.id, at: now, comments: comments.trim() }] };
              const otherPOs = pos_all.filter(p => p.id !== originalPO.id && p.id !== request.id);
              await savePOs([editApproved, updatedPO, ...otherPOs]);

              // Notify requester + dept heads
              if (addNotifications) {
                const notifs = [{ id: "N-" + Date.now() + "-poe", toUserId: request.requesterId, title: `${docLabel} Edit Applied`, message: `Your edit request for ${docNumberOf(originalPO)} is approved. Now at v${newVersion}.`, at: now, read: false, requestId: request.id }];
                getDeptHeadsForDept(request.dept, request.isProject).forEach((dh, idx) => { if (dh.id !== request.requesterId && dh.id !== user.id) notifs.push({ id: "N-" + Date.now() + "-pod-" + idx, toUserId: dh.id, title: `${docLabel} Updated`, message: `${docNumberOf(originalPO)} updated to v${newVersion} by ${user.name}.`, at: now, read: false, requestId: request.id }); });
                await addNotifications(notifs);
              }

              if (showToast) showToast(`${docLabel} ${docNumberOf(originalPO)} updated to v${newVersion}`, "success");
              setBusy(false); resetPOAssignForm(); return;
            }
          } else if (isDocCancel) {
            const originalPO = pos_all.find(p => p.id === cancellingDocId);
            if (originalPO) {
              const cancelledPO = { ...originalPO, status: "Cancelled", currentStage: "Cancelled", cancelledAt: now, cancelReason: request.reason, history: [...(originalPO.history || []), { action: "Cancelled", by: user.name, byId: user.id, at: now, comments: `Cancellation ${request.id} applied: ${request.reason}` }] };
              const cancelApproved = { ...request, currentStage: "Approved", status: "Approved", approvedBy: `${user.name}`, approvedDate: now, history: [...request.history, { action: "Cancellation Applied", by: user.name, byId: user.id, at: now, comments: comments.trim() }] };
              const otherPOs = pos_all.filter(p => p.id !== originalPO.id && p.id !== request.id);
              await savePOs([cancelApproved, cancelledPO, ...otherPOs]);

              if (addNotifications) {
                const notifs = [{ id: "N-" + Date.now() + "-poc", toUserId: request.requesterId, title: `${docLabel} Cancelled`, message: `${docNumberOf(originalPO)} (${originalPO.supplierName}) has been cancelled.`, at: now, read: false, requestId: request.id }];
                if (originalPO.requesterId !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-poco", toUserId: originalPO.requesterId, title: `Your ${docLabel} was Cancelled`, message: `${docNumberOf(originalPO)} cancelled. Reason: ${request.reason}`, at: now, read: false, requestId: request.id });
                getDeptHeadsForDept(originalPO.dept, originalPO.isProject).forEach((dh, idx) => { if (dh.id !== user.id && dh.id !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-pocd-" + idx, toUserId: dh.id, title: `${docLabel} Cancelled`, message: `${docNumberOf(originalPO)} cancelled.`, at: now, read: false, requestId: request.id }); });
                await addNotifications(notifs);
              }

              if (showToast) showToast(`${docLabel} ${docNumberOf(originalPO)} cancelled`, "warning");
              setBusy(false); resetPOAssignForm(); return;
            }
          } else {
            // POCreate/PICreate: assign document number + optional document
            const newCounter = docCounter + 1;
            const assignedNumber = poNumberInput.trim() || formatDocNumber(newCounter);
            await saveDocCounter(newCounter);
            extraUpdates = {
              [docNumberField]: assignedNumber,
              approvedBy: `${user.name} (${user.designation})`,
              approvedDate: now,
              // Attach the signed/stamped document if the accountant uploaded one
              ...(poAttachment ? { poDocument: poAttachment } : {}),
            };
            newStage = "Approved"; newStatus = "Approved";
            actionLabel = `${docLabel} Number Assigned: ${assignedNumber}`;
          }
        } else if (isPOorPI && isDocCancel && request.currentStage === "FinanceHead") {
          // Finance Head approves cancel directly (no Accountant step needed for cancel)
          const originalPO = pos_all.find(p => p.id === cancellingDocId);
          if (originalPO) {
            const cancelledPO = { ...originalPO, status: "Cancelled", currentStage: "Cancelled", cancelledAt: now, cancelReason: request.reason, history: [...(originalPO.history || []), { action: "Cancelled", by: user.name, byId: user.id, at: now, comments: `Cancellation ${request.id} approved: ${request.reason}` }] };
            const cancelApproved = { ...request, currentStage: "Approved", status: "Approved", approvedBy: `${user.name}`, approvedDate: now, history: [...request.history, { action: "Cancellation Approved", by: user.name, byId: user.id, at: now, comments: comments.trim() }] };
            const otherPOs = pos_all.filter(p => p.id !== originalPO.id && p.id !== request.id);
            await savePOs([cancelApproved, cancelledPO, ...otherPOs]);

            if (addNotifications) {
              const notifs = [{ id: "N-" + Date.now() + "-poc", toUserId: request.requesterId, title: `${docLabel} Cancelled`, message: `${docNumberOf(originalPO)} (${originalPO.supplierName}) has been cancelled.`, at: now, read: false, requestId: request.id }];
              if (originalPO.requesterId !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-poco", toUserId: originalPO.requesterId, title: `Your ${docLabel} was Cancelled`, message: `${docNumberOf(originalPO)} cancelled. Reason: ${request.reason}`, at: now, read: false, requestId: request.id });
              await addNotifications(notifs);
            }

            if (showToast) showToast(`${docLabel} ${docNumberOf(originalPO)} cancelled`, "warning");
            setBusy(false); resetPOAssignForm(); return;
          }
        } else if (request.currentStage === "DeptApproval" && request.selectedApprovers && request.selectedApprovers.length > 1) {
          const approvalsReceived = request.history.filter(h => h.action === "Approved (Dept)").length + 1;
          if (approvalsReceived < request.selectedApprovers.length) {
            newStage = "DeptApproval";
            newStatus = getStageLabel(newStage, reqKind) + ` (${approvalsReceived}/${request.selectedApprovers.length})`;
          } else {
            newStage = computeNextStage({ ...request, kind: reqKind }, "DeptApproval", user);
            newStatus = newStage === "Active" ? "Active" : newStage === "Approved" ? "Approved" : getStageLabel(newStage, reqKind);
          }
        } else {
          newStage = computeNextStage({ ...request, kind: reqKind }, request.currentStage, user);
          newStatus = newStage === "Active" ? "Active" : newStage === "Approved" ? "Approved" : getStageLabel(newStage, reqKind);
        }
      }
    } else if (actionType === "reject") {
      actionLabel = `Rejected at ${getStageLabel(request.currentStage, reqKind)}`;
      newStage = "Rejected"; newStatus = "Rejected";
    } else if (actionType === "process") {
      actionLabel = "Started Processing"; newStage = "Processing"; newStatus = "Processing Payment";
    } else if (actionType === "pay") {
      actionLabel = "Paid"; newStage = "Paid"; newStatus = "Paid";
      extraUpdates = { paymentUTR: paymentForm.utr.trim() || null, paymentMode: paymentForm.paymentMode, paymentDate: paymentForm.paymentDate, paymentProof: paymentForm.proofAttachment, paymentInvoice: paymentForm.invoiceAttachment, paidAt: now, paidBy: user.name, paidById: user.id };
    } else if (actionType === "undopay") {
      actionLabel = `Payment Undone by ${user.name}`;
      newStage = "Processing"; newStatus = "Processing Payment";
      extraUpdates = { paymentUTR: null, paymentMode: null, paymentDate: null, paymentProof: null, paymentInvoice: null, paidAt: null, paidBy: null };
    }

    let paymentNote = "";
    if (actionType === "pay") {
      const parts = [];
      if (paymentForm.utr) parts.push(`UTR: ${paymentForm.utr}`);
      parts.push(`Mode: ${paymentForm.paymentMode}`);
      parts.push(`Date: ${paymentForm.paymentDate}`);
      if (paymentForm.note) parts.push(paymentForm.note);
      paymentNote = parts.join(" · ");
    }

    const updateFn = (item) => {
      if (item.id !== request.id) return item;
      const updates = {
        ...item, ...extraUpdates,
        currentStage: newStage, status: newStatus,
        history: [...item.history, { action: actionLabel, by: user.name, byId: user.id, at: now, comments: comments.trim() || paymentNote || (actionType === "approve" ? "Approved" : "") }]
      };
      if (isBudget && newStage === "Active" && !item.approvedBy) { updates.approvedBy = `${user.name} (${user.designation})`; updates.approvedDate = now; }
      if (isPOorPI && newStage === "Approved" && !item.approvedDate) { updates.approvedBy = `${user.name} (${user.designation})`; updates.approvedDate = now; }
      return updates;
    };

    if (isBudget) await saveBudgets(budgets_all.map(updateFn));
    else if (isPOorPI) await savePOs(pos_all.map(updateFn));
    else {
      const updatedRequests = requests_all.map(updateFn);
      await saveRequests(updatedRequests);
      // Auto-close any PO that's now 100% paid — handles single-PO payments and
      // each PO referenced by a split payment. Uses the split-aware getPOUsage.
      if (actionType === "pay") {
        const affectedPOIds = [...new Set((request.splits?.length ? request.splits.map(s => s.linkedPOId) : [request.linkedPOId]).filter(Boolean))];
        let updatedPOs = pos_all;
        const closed = [];
        affectedPOIds.forEach(poId => {
          const po = updatedPOs.find(p => p.id === poId);
          if (po && (po.status === "Approved" || po.currentStage === "Approved")) {
            const paidAfter = getPOUsage(updatedRequests, poId).paid;
            if (paidAfter >= po.amountINR) {
              updatedPOs = updatedPOs.map(p => p.id === poId ? { ...po, status: "Closed", currentStage: "Closed", closedAt: now, history: [...(po.history || []), { action: "Auto-Closed (100% paid)", by: "System", byId: "SYS", at: now, comments: `Fully consumed; total paid ₹${(paidAfter / 100000).toFixed(2)}L.` }] } : p);
              closed.push(po.poNumber);
            }
          }
        });
        if (closed.length) { await savePOs(updatedPOs); if (showToast) showToast(`PO ${closed.join(", ")} auto-closed (fully paid)`, "info"); }
      }
    }

    if (actionType === "pay" && addNotifications) {
      const notifs = [{ id: "N-" + Date.now() + "-1", toUserId: request.requesterId, title: "Payment Completed", message: `Your request ${request.id} (₹${(request.amountINR || request.amount).toLocaleString("en-IN")}) has been paid.${paymentForm.utr ? ` UTR: ${paymentForm.utr}` : ""}`, at: now, read: false, requestId: request.id }];
      const deptHeads = getDeptHeadsForDept(request.dept, request.isProject);
      deptHeads.forEach((dh, idx) => { if (dh.id !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-dh-" + idx, toUserId: dh.id, title: "Payment in Your Dept", message: `${request.requesterName}'s request ${request.id} paid.`, at: now, read: false, requestId: request.id }); });
      const fh = getRoster().find(u => u.role === "FinanceHead");
      if (fh && fh.id !== user.id) notifs.push({ id: "N-" + Date.now() + "-fh", toUserId: fh.id, title: "Payment Completed", message: `${request.id} — ${request.requesterName} — ₹${(request.amountINR || request.amount).toLocaleString("en-IN")}`, at: now, read: false, requestId: request.id });
      await addNotifications(notifs);
      if (showToast) showToast("Payment paid. Notifications sent.", "success");
    }

    // Notify on PO/PI Create approval (when the document number is assigned)
    if (actionType === "approve" && isPOorPI && (request.type === "POCreate" || request.type === "PICreate") && newStage === "Approved" && addNotifications) {
      const assignedNum = extraUpdates[docNumberField] || docNumberOf(request);
      const payLine = isPI ? "" : " You can now raise payments against it.";
      const notifs = [{ id: "N-" + Date.now() + "-poa", toUserId: request.requesterId, title: `${docLabel} Approved`, message: `Your ${docLabel} request is approved with number ${assignedNum}.${payLine}`, at: now, read: false, requestId: request.id }];
      getDeptHeadsForDept(request.dept, request.isProject).forEach((dh, idx) => { if (dh.id !== request.requesterId && dh.id !== user.id) notifs.push({ id: "N-" + Date.now() + "-poad-" + idx, toUserId: dh.id, title: `${docLabel} Approved in Your Dept`, message: `${assignedNum} (${request.supplierName}) approved for ₹${(request.amountINR / 100000).toFixed(2)}L.`, at: now, read: false, requestId: request.id }); });
      await addNotifications(notifs);
    }

    if (actionType === "undopay" && showToast) showToast("Payment reversal logged.", "warning");
    if (actionType === "approve" && showToast) showToast("Approved", "success");
    if (actionType === "reject" && showToast) showToast("Rejected", "info");

    setBusy(false); resetPOAssignForm();
    setPaymentForm({ utr: "", paymentMode: "Bank Transfer", paymentDate: new Date().toISOString().slice(0, 10), proofAttachment: null, invoiceAttachment: null, note: "" });
  }

  const stage = request.currentStage;
  const isApprovalStage = ["BoxBuildMid", "DeptApproval", "VP", "CEO", "SuperManagerApproval", "FinanceHead"].includes(stage);
  const isPOAccountant = isPOorPI && stage === "Accountant";
  const isProcessStage = stage === "Accountant" && !isBudget && !isPOorPI;
  const isPayStage = stage === "Processing" && !isBudget && !isPOorPI;
  const canSuperMarkPaid = isSuperManager && !isBudget && !isPOorPI && (stage === "Accountant" || stage === "Processing");
  const canUndoPaid = stage === "Paid" && request.paidAt && user.role === "Accountant" && (Date.now() - new Date(request.paidAt).getTime() < 24 * 60 * 60 * 1000);

  return (
    <div className="mt-3">
      {!mode && (
        <div className="flex gap-2 flex-wrap">
          {isApprovalStage && (
            <>
              <button onClick={() => setMode("approve")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Approve</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {isPOAccountant && (
            <>
              <button onClick={() => setMode("po-assign")} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5" />{isDocEdit ? "Apply Edit" : isDocCancel ? "Apply Cancel" : `Assign ${docLabel} Number`}</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {isProcessStage && !isSuperManager && (
            <>
              <button onClick={() => setMode("process")} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Start Processing</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {isPayStage && !isSuperManager && (
            <>
              <button onClick={() => setMode("pay")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Mark as Paid</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {canSuperMarkPaid && (
            <>
              {stage === "Accountant" && <button onClick={() => setMode("process")} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Start Processing</button>}
              <button onClick={() => setMode("pay")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Mark Paid Directly</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {canUndoPaid && (
            <button onClick={() => setMode("undopay")} className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Undo2 className="w-3.5 h-3.5" />Undo Payment</button>
          )}
        </div>
      )}

      {/* PO Number Assignment / Apply Edit / Apply Cancel */}
      {mode === "po-assign" && (
        <div className="space-y-3 bg-fuchsia-50 p-4 rounded-lg border border-fuchsia-200">
          <div className="text-sm font-semibold text-fuchsia-900 flex items-center gap-1.5">
            <FileSignature className="w-4 h-4" />
            {isDocEdit ? `Apply Edit to ${editingDocNumber}` : isDocCancel ? `Cancel ${cancellingDocNumber}` : `Assign ${docLabel} Number & Attach Document`}
          </div>

          {/* Document number field — only for create */}
          {!isDocEdit && !isDocCancel && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{docLabel} Number</label>
              <input value={poNumberInput} onChange={(e) => setPONumberInput(e.target.value)} placeholder={`Auto: ${formatDocNumber(docCounter + 1)}`} className="w-full text-xs px-2 py-1.5 border border-fuchsia-300 rounded-lg font-mono" />
              <p className="text-xs text-slate-500 mt-1">Leave blank to auto-assign {formatDocNumber(docCounter + 1)}, or type a custom number.</p>
            </div>
          )}

          {/* Document upload — for create only (edit/cancel don't issue a new document) */}
          {!isDocEdit && !isDocCancel && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {docLabel} Document <span className="text-red-500">*</span> <span className="font-normal text-slate-500">(signed / stamped — required)</span>
              </label>
              {!poAttachment ? (
                <label className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-fuchsia-300 rounded-lg cursor-pointer hover:border-fuchsia-500 hover:bg-fuchsia-100/50 text-xs text-slate-600 transition">
                  <Upload className="w-4 h-4 text-fuchsia-500" />
                  <span>Upload signed {docLabel} document <span className="text-slate-400">(PDF, PNG, JPG — max 2 MB)</span></span>
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handlePOAttachmentUpload} />
                </label>
              ) : (
                <div className="bg-white border border-fuchsia-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">{poAttachment.name}</div>
                      <div className="text-slate-500">{(poAttachment.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button onClick={() => setPOAttachment(null)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Remove">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Comment (optional)</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => doAction("approve")} disabled={busy || (!isDocEdit && !isDocCancel && !poAttachment)} className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              {isDocEdit ? "Apply Edit" : isDocCancel ? "Confirm Cancellation" : "Assign & Approve"}
            </button>
            <button onClick={resetPOAssignForm} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Payment marking */}
      {mode === "pay" && (
        <div className="space-y-3 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <div className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5"><CheckSquare className="w-4 h-4" />Record Payment Details</div>
          <p className="text-xs text-emerald-700">Attach an invoice or a payment-done document (at least one is required). UTR also recommended for audit.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">UTR / Ref</label><input value={paymentForm.utr} onChange={(e) => setPaymentForm({ ...paymentForm, utr: e.target.value })} placeholder="UTR123456" className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">Mode</label>
              <select value={paymentForm.paymentMode} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg">
                <option>Bank Transfer</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option><option>Cash</option><option>Credit Card</option><option>Other</option>
              </select>
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label><input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" /></div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice / Bill <span className="font-normal text-slate-500">(attach this or the payment proof)</span></label>
            {!paymentForm.invoiceAttachment ? (
              <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-white text-xs">
                <Upload className="w-4 h-4" />Upload invoice / bill (PDF, PNG, JPG, DOC — max 2MB)
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handlePaymentInvoiceUpload} />
              </label>
            ) : (
              <div className="bg-white border border-emerald-200 rounded-lg p-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><Paperclip className="w-3 h-3 text-emerald-700" /><span className="font-medium">{paymentForm.invoiceAttachment.name}</span></div>
                <button onClick={() => setPaymentForm({ ...paymentForm, invoiceAttachment: null })} className="text-red-600"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Proof / Receipt <span className="font-normal text-slate-500">(attach this or the invoice)</span></label>
            {!paymentForm.proofAttachment ? (
              <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-white text-xs">
                <Upload className="w-4 h-4" />Upload payment-done proof (PDF, PNG, JPG — max 2MB)
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handlePaymentProofUpload} />
              </label>
            ) : (
              <div className="bg-white border border-emerald-200 rounded-lg p-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><Paperclip className="w-3 h-3 text-emerald-700" /><span className="font-medium">{paymentForm.proofAttachment.name}</span></div>
                <button onClick={() => setPaymentForm({ ...paymentForm, proofAttachment: null })} className="text-red-600"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">Note</label><input value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => doAction("pay")} disabled={busy || (!paymentForm.invoiceAttachment && !paymentForm.proofAttachment)} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirm Payment Done</button>
            <button onClick={() => setMode(null)} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Undo Pay */}
      {mode === "undopay" && (
        <div className="space-y-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Reverse this payment</div>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Reason for reversal (mandatory)" rows={2} className="w-full text-xs px-2 py-1.5 border border-amber-200 rounded-lg" />
          <div className="flex gap-2">
            <button onClick={() => { if (!comments.trim()) { alert("Reason mandatory"); return; } doAction("undopay"); }} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirm Undo</button>
            <button onClick={() => { setMode(null); setComments(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Approve / Reject / Process modes */}
      {mode && !["pay", "undopay", "po-assign"].includes(mode) && (
        <div className={`space-y-2 p-3 rounded-lg border ${mode === "reject" ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
          <div className={`text-xs font-semibold flex items-center gap-1.5 ${mode === "reject" ? "text-red-900" : "text-slate-900"}`}>
            {mode === "reject" && <><AlertTriangle className="w-3.5 h-3.5" />Reason mandatory</>}
            {mode === "approve" && "Add comment (recommended)"}
            {mode === "process" && "Add note (optional)"}
          </div>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={mode === "reject" ? "Why?" : "Optional"} rows={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg" />
          <div className="flex gap-2">
            <button onClick={() => doAction(mode)} disabled={busy || (mode === "reject" && !comments.trim())} className={`text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:bg-slate-400 ${mode === "reject" ? "bg-red-600" : "bg-emerald-600"}`}>Confirm {mode}</button>
            <button onClick={() => { setMode(null); setComments(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
