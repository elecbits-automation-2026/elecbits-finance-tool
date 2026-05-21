import { useState } from "react";
import { FileSignature, Edit3, Eye, Paperclip, History, CheckCircle2, XCircle, Ban } from "lucide-react";
import { CURRENCIES } from "../constants";
import { getPOUsage, getPOAvailable } from "../lib/finance";
import { AttachmentViewer } from "../components/AttachmentViewer";
import { NewPORequestForm } from "../forms/NewPORequestForm";

// ============ PO LIST VIEW ============
export function POListView({ user, pos, requests, budgets, savePOs, savePOCounter, poCounter, addNotifications, showToast }) {
  const [tab, setTab] = useState("approved");
  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);

  if (editTarget) {
    return (
      <div>
        <button onClick={() => setEditTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back to POs</button>
        <NewPORequestForm user={user} budgets={budgets} pos={pos} requests={requests} savePOs={savePOs} editFor={editTarget} onSuccess={() => { setEditTarget(null); showToast("Edit request submitted", "success"); }} />
      </div>
    );
  }

  async function manuallyClosePO(po) {
    if (!confirm(`Close PO ${po.poNumber}? No new payments can be raised against it after closing.`)) return;
    const now = new Date().toISOString();
    const updated = pos.map(p => p.id === po.id ? {
      ...p,
      status: "Closed",
      currentStage: "Closed",
      closedAt: now,
      history: [...(p.history || []), { action: "Manually Closed", by: user.name, byId: user.id, at: now, comments: "Closed by Finance Head" }]
    } : p);
    await savePOs(updated);
    showToast(`PO ${po.poNumber} closed`, "info");
    setCloseTarget(null);
  }

  // Only show actual PO records (POCreate) — edits/cancels are tracked elsewhere
  const allPOs = pos.filter(p => p.type === "POCreate");
  const approved = allPOs.filter(p => p.status === "Approved" || p.currentStage === "Approved");
  const pending = pos.filter(p => !["Approved", "Closed", "Cancelled", "Rejected"].includes(p.status));
  const closed = allPOs.filter(p => p.status === "Closed");
  const cancelled = allPOs.filter(p => p.status === "Cancelled");
  const rejected = pos.filter(p => p.status === "Rejected");

  const list = tab === "approved" ? approved : tab === "pending" ? pending : tab === "closed" ? closed : tab === "cancelled" ? cancelled : rejected;

  return (
    <div>
      {cancelTarget && <POCancelModal po={cancelTarget} user={user} pos={pos} savePOs={savePOs} onClose={() => setCancelTarget(null)} showToast={showToast} />}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("approved")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "approved" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Approved ({approved.length})</button>
        <button onClick={() => setTab("pending")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "pending" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Pending ({pending.length})</button>
        <button onClick={() => setTab("closed")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "closed" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Closed ({closed.length})</button>
        <button onClick={() => setTab("cancelled")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "cancelled" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Cancelled ({cancelled.length})</button>
        <button onClick={() => setTab("rejected")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "rejected" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Rejected ({rejected.length})</button>
      </div>
      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No POs in this category.</div>
      ) : (
        <div className="space-y-2">
          {list.map(po => <POCard key={po.id} po={po} requests={requests} pos={pos} user={user} onEdit={() => setEditTarget(po)} onCancel={() => setCancelTarget(po)} onClose={() => manuallyClosePO(po)} />)}
        </div>
      )}
    </div>
  );
}

function POCard({ po, requests, pos, user, onEdit, onCancel, onClose: onCloseManually }) {
  const [expanded, setExpanded] = useState(false);
  const [viewAttachment, setViewAttachment] = useState(null);
  const usage = getPOUsage(requests, po.id);
  const available = getPOAvailable(po, requests);
  const linkedReqs = requests.filter(r => r.linkedPOId === po.id);
  const isApproved = po.status === "Approved" || po.currentStage === "Approved";
  const isCancelled = po.status === "Cancelled" || po.currentStage === "Cancelled";
  const isClosed = po.status === "Closed" || po.currentStage === "Closed";
  const canEdit = isApproved && !isCancelled;
  const canCancel = isApproved && !isCancelled;
  const canManualClose = isApproved && !isCancelled && user.role === "FinanceHead" && onCloseManually;
  const pendingEdits = pos.filter(p => p.type === "POEdit" && p.editingPOId === po.id && !["Approved", "Rejected", "Cancelled"].includes(p.status));
  const statusColor = isApproved ? "emerald" : isCancelled ? "slate" : isClosed ? "slate" : po.status === "Rejected" ? "red" : "amber";

  return (
    <div className={`bg-white rounded-xl border ${isCancelled ? "border-slate-200 opacity-75" : "border-fuchsia-200"}`}>
      {viewAttachment && <AttachmentViewer attachment={viewAttachment} onClose={() => setViewAttachment(null)} />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-fuchsia-100 text-fuchsia-700"><FileSignature className="w-3 h-3 inline mr-0.5" />PO</span>
              {po.poNumber && <span className="font-mono text-xs font-bold text-fuchsia-900">{po.poNumber}</span>}
              {po.version > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100">v{po.version}</span>}
              <span className={`text-xs px-2 py-0.5 rounded font-semibold bg-${statusColor}-100 text-${statusColor}-700`}>{po.status}</span>
              {po.isProject ? <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">Project</span> : <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">Non-Project</span>}
              {pendingEdits.length > 0 && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold"><Edit3 className="w-3 h-3 inline mr-0.5" />Edit Pending</span>}
            </div>
            <div className="font-semibold text-slate-900 text-sm">{po.supplierName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {po.isProject ? `Project: ${po.projectId}` : `${po.dept} · ${po.category}`}
              {" · "}By <strong>{po.requesterName}</strong>
              {" · "}{new Date(po.createdDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">₹{(po.amountINR / 100000).toFixed(2)}L</div>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1 mt-0.5 ml-auto"><Eye className="w-3 h-3" />{expanded ? "Hide" : "View"}</button>
          </div>
        </div>

        {isApproved && !isCancelled && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Paid</div><div className="font-bold">₹{(usage.paid / 100000).toFixed(2)}L</div></div>
            <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Committed</div><div className="font-bold">₹{(usage.committed / 100000).toFixed(2)}L</div></div>
            <div className="bg-blue-50 rounded p-2"><div className="text-blue-700">Available</div><div className="font-bold">₹{(available / 100000).toFixed(2)}L</div></div>
          </div>
        )}

        {(canEdit || canCancel || canManualClose) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {canEdit && <button onClick={onEdit} className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />Request Edit</button>}
            {canCancel && <button onClick={onCancel} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" />Request Cancel</button>}
            {canManualClose && <button onClick={onCloseManually} className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Close PO</button>}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div>
              <div className="font-bold text-slate-700 mb-1">Supplier</div>
              <div>{po.supplierName}</div>
              <div>{po.supplierAddress}</div>
              {po.isInternational ? (
                <>
                  <div>Country: <strong>{po.supplierCountry}</strong> <span className="text-slate-500">(International)</span></div>
                  {po.supplierTaxId && <div>Tax ID: <span className="font-mono">{po.supplierTaxId}</span></div>}
                </>
              ) : (
                po.supplierGST && <div>GSTIN: <span className="font-mono">{po.supplierGST}</span></div>
              )}
            </div>

            {po.lineItems && po.lineItems.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1">Line Items ({po.lineItems.length})</div>
                <div className="overflow-x-auto bg-slate-50 rounded-lg p-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-600 font-semibold">
                        <th className="p-1">#</th><th className="p-1">Description</th><th className="p-1 text-right">Qty</th><th className="p-1">Unit</th><th className="p-1 text-right">Unit Cost</th><th className="p-1 text-right">GST%</th><th className="p-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.lineItems.map((li, idx) => {
                        const sub = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                        const gst = sub * (parseFloat(li.gstPct || 0) / 100);
                        return (
                          <tr key={li.id || idx} className="border-t border-slate-200">
                            <td className="p-1">{idx + 1}</td>
                            <td className="p-1">{li.description}</td>
                            <td className="p-1 text-right">{li.qty}</td>
                            <td className="p-1">{li.unit}</td>
                            <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{parseFloat(li.unitCost || 0).toLocaleString("en-IN")}</td>
                            <td className="p-1 text-right">{li.gstPct}%</td>
                            <td className="p-1 text-right font-semibold">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(sub + gst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-white">
                        <td colSpan={6} className="p-1 text-right font-semibold">Subtotal:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(po.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-white">
                        <td colSpan={6} className="p-1 text-right font-semibold">GST:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(po.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-fuchsia-100 font-bold">
                        <td colSpan={6} className="p-1 text-right">Grand Total:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(po.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {po.currency !== "INR" && <div className="text-xs text-slate-500 mt-1">≈ ₹{(po.amountINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} @ ₹{po.fxRate}/{po.currency}</div>}
              </div>
            )}

            <div><div className="font-bold text-slate-700 mb-1">Scope Summary</div><div className="whitespace-pre-wrap">{po.scope}</div></div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">Delivery:</span> {po.deliveryTimeline}</div>
              <div><span className="text-slate-500">Terms:</span> {po.paymentTerms}</div>
            </div>
            {po.attachment && <div><span className="text-slate-500">Quote:</span> <button onClick={() => setViewAttachment(po.attachment)} className="text-fuchsia-700 underline font-medium inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{po.attachment.name}</button></div>}
            {linkedReqs.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1">Linked Payments ({linkedReqs.length})</div>
                <div className="space-y-1">
                  {linkedReqs.map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-slate-50 rounded p-1.5">
                      <span className="font-mono">{r.id}</span>
                      <span>{r.requesterName}</span>
                      <span className="font-semibold">₹{(r.amountINR / 100000).toFixed(2)}L</span>
                      <span className="text-slate-500">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {po.editHistory && po.editHistory.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><History className="w-3 h-3" />Edit History</div>
                <div className="space-y-1">
                  {po.editHistory.map((eh, i) => (
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
                {(po.history || []).map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${h.action.includes("Reject") ? "bg-red-100 text-red-600" : "bg-fuchsia-100 text-fuchsia-600"}`}>
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

function POCancelModal({ po, user, pos, savePOs, onClose, showToast }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const cancelReq = {
      id: "POCANCEL-" + Date.now(), kind: "PO", type: "POCancel",
      cancellingPOId: po.id, cancellingPONumber: po.poNumber,
      createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
      isProject: po.isProject, projectId: po.projectId, supplierName: po.supplierName,
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
        <div className="flex items-center gap-2 mb-3"><Ban className="w-5 h-5 text-red-600" /><div className="font-bold">Cancel PO {po.poNumber}</div></div>
        <p className="text-sm text-slate-600 mb-3">Goes to Finance Head for approval. Once cancelled, no new payments can be raised.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (mandatory)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <div className="flex gap-2 mt-3">
          <button onClick={submit} disabled={busy || !reason.trim()} className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg">Submit Cancellation</button>
          <button onClick={onClose} className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg">Nevermind</button>
        </div>
      </div>
    </div>
  );
}
