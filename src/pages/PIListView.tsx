import { useState } from "react";
import { FileSignature, Edit3, Eye, Paperclip, History, CheckCircle2, XCircle, Ban } from "lucide-react";
import { CURRENCIES } from "../constants";
import { isReadOnly } from "../lib/access";
import { AttachmentViewer } from "../components/AttachmentViewer";
import { NewPIRequestForm } from "../forms/NewPIRequestForm";

// ============ PI LIST VIEW ============
// Mirror of POListView, scoped to Proforma Invoice (PI) records. A PI's own number is
// in `piNumber`; the optional referenced PO is in `hasPO`/`poNumber`/`poGstPct`.
export function PIListView({ user, pos, requests, budgets, suppliers, savePOs, saveSuppliers, showToast }) {
  const [tab, setTab] = useState("approved");
  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  if (editTarget) {
    return (
      <div>
        <button onClick={() => setEditTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back to PIs</button>
        <NewPIRequestForm user={user} budgets={budgets} pos={pos} requests={requests} savePOs={savePOs} editFor={editTarget} onSuccess={() => { setEditTarget(null); showToast("Edit request submitted", "success"); }} />
      </div>
    );
  }

  // Only PI records (POs are listed in their own view).
  const piRecords = pos.filter(p => p.kind === "PI");
  // Read-only viewers only see their own department's PIs.
  const scopedPis = isReadOnly(user) ? piRecords.filter(p => p.dept === user.dept) : piRecords;

  // Only show actual PI records (PICreate) — edits/cancels are tracked elsewhere
  const allPIs = scopedPis.filter(p => p.type === "PICreate");
  const approved = allPIs.filter(p => p.status === "Approved" || p.currentStage === "Approved");
  const pending = scopedPis.filter(p => !["Approved", "Closed", "Cancelled", "Rejected"].includes(p.status));
  const closed = allPIs.filter(p => p.status === "Closed");
  const cancelled = allPIs.filter(p => p.status === "Cancelled");
  const rejected = scopedPis.filter(p => p.status === "Rejected");

  const list = tab === "approved" ? approved : tab === "pending" ? pending : tab === "closed" ? closed : tab === "cancelled" ? cancelled : rejected;

  return (
    <div>
      {cancelTarget && <PICancelModal pi={cancelTarget} user={user} pos={pos} savePOs={savePOs} onClose={() => setCancelTarget(null)} showToast={showToast} />}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("approved")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "approved" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-600"}`}>Approved ({approved.length})</button>
        <button onClick={() => setTab("pending")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "pending" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-600"}`}>Pending ({pending.length})</button>
        <button onClick={() => setTab("closed")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "closed" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-600"}`}>Closed ({closed.length})</button>
        <button onClick={() => setTab("cancelled")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "cancelled" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-600"}`}>Cancelled ({cancelled.length})</button>
        <button onClick={() => setTab("rejected")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "rejected" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-600"}`}>Rejected ({rejected.length})</button>
      </div>
      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No PIs in this category.</div>
      ) : (
        <div className="space-y-2">
          {list.map(pi => <PICard key={pi.id} pi={pi} pos={pos} user={user} onEdit={() => setEditTarget(pi)} onCancel={() => setCancelTarget(pi)} />)}
        </div>
      )}
    </div>
  );
}

function PICard({ pi, pos, user, onEdit, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const [viewAttachment, setViewAttachment] = useState(null);
  const isApproved = pi.status === "Approved" || pi.currentStage === "Approved";
  const isCancelled = pi.status === "Cancelled" || pi.currentStage === "Cancelled";
  const isClosed = pi.status === "Closed" || pi.currentStage === "Closed";
  // Policy: once approved, a PI is view-only — no edits or cancellations.
  const canEdit = false;
  const canCancel = false;
  const pendingEdits = pos.filter(p => p.type === "PIEdit" && p.editingPIId === pi.id && !["Approved", "Rejected", "Cancelled"].includes(p.status));
  const statusColor = isApproved ? "emerald" : isCancelled ? "slate" : isClosed ? "slate" : pi.status === "Rejected" ? "red" : "amber";

  return (
    <div className={`bg-white rounded-xl border ${isCancelled ? "border-slate-200 opacity-75" : "border-teal-200"}`}>
      {viewAttachment && <AttachmentViewer attachment={viewAttachment} onClose={() => setViewAttachment(null)} />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-teal-100 text-teal-700"><FileSignature className="w-3 h-3 inline mr-0.5" />PI</span>
              {pi.piNumber && <span className="font-mono text-xs font-bold text-teal-900">{pi.piNumber}</span>}
              {pi.version > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100">v{pi.version}</span>}
              <span className={`text-xs px-2 py-0.5 rounded font-semibold bg-${statusColor}-100 text-${statusColor}-700`}>{pi.status}</span>
              {pi.isProject ? <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">Project</span> : <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">Non-Project</span>}
              {pendingEdits.length > 0 && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold"><Edit3 className="w-3 h-3 inline mr-0.5" />Edit Pending</span>}
            </div>
            <div className="font-semibold text-slate-900 text-sm">{pi.supplierName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {pi.isProject ? `Project: ${pi.projectId}` : `${pi.dept} · ${pi.category}`}
              {" · "}By <strong>{pi.requesterName}</strong>
              {" · "}{new Date(pi.createdDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">₹{(pi.amountINR / 100000).toFixed(2)}L</div>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 mt-0.5 ml-auto"><Eye className="w-3 h-3" />{expanded ? "Hide" : "View"}</button>
          </div>
        </div>

        {(canEdit || canCancel) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {canEdit && <button onClick={onEdit} className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />Request Edit</button>}
            {canCancel && <button onClick={onCancel} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" />Request Cancel</button>}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div>
              <div className="font-bold text-slate-700 mb-1">Client</div>
              <div>{pi.supplierName}</div>
              <div>{pi.supplierAddress}</div>
              {pi.isInternational ? (
                <>
                  <div>Country: <strong>{pi.supplierCountry}</strong> <span className="text-slate-500">(International)</span></div>
                  {pi.supplierTaxId && <div>Tax ID: <span className="font-mono">{pi.supplierTaxId}</span></div>}
                </>
              ) : (
                pi.supplierGST && <div>GSTIN: <span className="font-mono">{pi.supplierGST}</span></div>
              )}
            </div>

            {pi.hasPO && (
              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-2">
                <div className="font-bold text-fuchsia-900 mb-1">📄 Purchase Order{pi.poNumber ? ` · ${pi.poNumber}` : ""}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {(pi.totalGST || 0) > 0 ? (
                    <>
                      <span>Subtotal: <strong>{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                      <span>GST{pi.poGstPct != null ? ` (${pi.poGstPct}%)` : ""}: <strong>{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                      <span className="text-fuchsia-900">Grand Total: <strong>{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                    </>
                  ) : (
                    <span className="text-fuchsia-900">Total Amount: <strong>{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                  )}
                </div>
                {pi.currency !== "INR" && <div className="text-xs text-slate-500 mt-1">≈ ₹{(pi.amountINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} @ ₹{pi.fxRate}/{pi.currency}</div>}
              </div>
            )}

            {pi.lineItems && pi.lineItems.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1">Line Items ({pi.lineItems.length})</div>
                <div className="overflow-x-auto bg-slate-50 rounded-lg p-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-600 font-semibold">
                        <th className="p-1">#</th><th className="p-1">Description</th><th className="p-1 text-right">Qty</th><th className="p-1">Unit</th><th className="p-1 text-right">Unit Cost</th><th className="p-1 text-right">GST%</th><th className="p-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pi.lineItems.map((li, idx) => {
                        const sub = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                        const gst = sub * (parseFloat(li.gstPct || 0) / 100);
                        return (
                          <tr key={li.id || idx} className="border-t border-slate-200">
                            <td className="p-1">{idx + 1}</td>
                            <td className="p-1">{li.description}</td>
                            <td className="p-1 text-right">{li.qty}</td>
                            <td className="p-1">{li.unit}</td>
                            <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{parseFloat(li.unitCost || 0).toLocaleString("en-IN")}</td>
                            <td className="p-1 text-right">{li.gstPct}%</td>
                            <td className="p-1 text-right font-semibold">{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(sub + gst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-white">
                        <td colSpan={6} className="p-1 text-right font-semibold">Subtotal:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-white">
                        <td colSpan={6} className="p-1 text-right font-semibold">GST:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-teal-100 font-bold">
                        <td colSpan={6} className="p-1 text-right">Grand Total:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === pi.currency)?.symbol || "₹")}{(pi.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {pi.currency !== "INR" && <div className="text-xs text-slate-500 mt-1">≈ ₹{(pi.amountINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} @ ₹{pi.fxRate}/{pi.currency}</div>}
              </div>
            )}

            <div><div className="font-bold text-slate-700 mb-1">Scope Summary</div><div className="whitespace-pre-wrap">{pi.scope}</div></div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">Delivery:</span> {pi.deliveryTimeline}</div>
              <div><span className="text-slate-500">Terms:</span> {pi.paymentTerms}</div>
            </div>
            {pi.attachment && <div><span className="text-slate-500">Quote:</span> <button onClick={() => setViewAttachment(pi.attachment)} className="text-teal-700 underline font-medium inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{pi.attachment.name}</button></div>}
            {pi.editHistory && pi.editHistory.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><History className="w-3 h-3" />Edit History</div>
                <div className="space-y-1">
                  {pi.editHistory.map((eh, i) => (
                    <div key={i} className="bg-slate-50 rounded p-2">
                      <div className="font-semibold">v{eh.version} · {new Date(eh.at).toLocaleString("en-IN", { day: "numeric", month: "short" })}</div>
                      <div className="text-slate-600">By {eh.by}</div>
                      <div className="italic">"{eh.changeNote}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="font-bold text-slate-700 mb-1">Approval History</div>
              <div className="space-y-1">
                {(pi.history || []).map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${h.action.includes("Reject") ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600"}`}>
                      {h.action.includes("Reject") ? <XCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{h.action}</div>
                      <div className="text-slate-600">By {h.by} · {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      {h.comments && <div className="text-slate-500 italic">"{h.comments}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PICancelModal({ pi, user, pos, savePOs, onClose, showToast }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const cancelReq = {
      id: "PICANCEL-" + Date.now(), kind: "PI", type: "PICancel",
      cancellingPIId: pi.id, cancellingPINumber: pi.piNumber,
      createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
      isProject: pi.isProject, projectId: pi.projectId, supplierName: pi.supplierName,
      amount: 0, amountINR: 0, currency: "INR", fxRate: 1, reason,
      currentStage: "FinanceHead", status: "Pending Finance Head",
      selectedApprovers: [],
      history: [{ action: "Cancellation Requested", by: user.name, byId: user.id, at: now, comments: reason }],
    };
    await savePOs([cancelReq, ...pos]);
    setBusy(false);
    showToast("Cancellation request sent to Finance Head", "success");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3"><Ban className="w-5 h-5 text-red-600" /><div className="font-bold">Cancel PI {pi.piNumber}</div></div>
        <p className="text-sm text-slate-600 mb-3">Goes to Finance Head for approval. Once cancelled, the PI is closed.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (mandatory)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <div className="flex gap-2 mt-3">
          <button onClick={submit} disabled={busy || !reason.trim()} className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg">Submit Cancellation</button>
          <button onClick={onClose} className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg">Nevermind</button>
        </div>
      </div>
    </div>
  );
}
