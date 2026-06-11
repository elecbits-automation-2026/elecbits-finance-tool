import { useState } from "react";
import { Edit3, History, XCircle, CheckCircle2, Ban, Paperclip } from "lucide-react";
import { CURRENCIES } from "../constants";
import { getRoster } from "../lib/roster";
import { AttachmentViewer } from "../components/AttachmentViewer";

export function RequestDetails({ request: r, pos_all }) {
  const [viewAttachment, setViewAttachment] = useState(null);
  const isBudget = r.kind === "Budget";
  const isPO = r.kind === "PO";
  const isPOEdit = isPO && r.type === "POEdit";
  const originalPO = isPOEdit && pos_all ? pos_all.find(p => p.id === r.editingPOId) : null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {viewAttachment && <AttachmentViewer attachment={viewAttachment} onClose={() => setViewAttachment(null)} />}
      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Details</div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {isPO && (
            <>
              <div className="sm:col-span-2"><span className="text-slate-500">Supplier:</span> <strong>{r.supplierName}</strong></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Address:</span> {r.supplierAddress}</div>
              {r.isInternational ? (
                <>
                  <div><span className="text-slate-500">Country:</span> {r.supplierCountry} <span className="text-fuchsia-600">(Intl)</span></div>
                  {r.supplierTaxId && <div><span className="text-slate-500">Tax ID:</span> <span className="font-mono">{r.supplierTaxId}</span></div>}
                </>
              ) : (
                r.supplierGST && <div><span className="text-slate-500">GSTIN:</span> <span className="font-mono">{r.supplierGST}</span></div>
              )}
              <div><span className="text-slate-500">Delivery:</span> {r.deliveryTimeline}</div>
              <div><span className="text-slate-500">Terms:</span> {r.paymentTerms}</div>
              <div className="sm:col-span-2"><span className="text-slate-500">Scope:</span> <span className="whitespace-pre-wrap">{r.scope}</span></div>
              {r.lineItems && r.lineItems.length > 0 && (
                <div className="sm:col-span-2 bg-purple-50 rounded p-2 border border-purple-200">
                  <div className="text-xs font-bold text-purple-900 mb-1">📋 Line Items ({r.lineItems.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-slate-600 font-semibold"><th className="p-1">#</th><th className="p-1">Description</th><th className="p-1 text-right">Qty</th><th className="p-1">Unit</th><th className="p-1 text-right">Cost</th><th className="p-1 text-right">GST</th><th className="p-1 text-right">Total</th></tr></thead>
                      <tbody>
                        {r.lineItems.map((li, idx) => {
                          const sub = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                          const gst = sub * (parseFloat(li.gstPct || 0) / 100);
                          return <tr key={li.id || idx} className="border-t border-purple-200"><td className="p-1">{idx + 1}</td><td className="p-1">{li.description}</td><td className="p-1 text-right">{li.qty}</td><td className="p-1">{li.unit}</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{parseFloat(li.unitCost || 0).toLocaleString("en-IN")}</td><td className="p-1 text-right">{li.gstPct}%</td><td className="p-1 text-right font-semibold">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(sub + gst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>;
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-purple-300 bg-white"><td colSpan={6} className="p-1 text-right font-semibold">Subtotal:</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
                        <tr className="bg-white"><td colSpan={6} className="p-1 text-right font-semibold">GST:</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
                        <tr className="bg-purple-100 font-bold"><td colSpan={6} className="p-1 text-right">Grand Total:</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              {r.editReason && <div className="sm:col-span-2"><span className="text-slate-500">Edit Reason:</span> {r.editReason}</div>}
              {r.changeNote && <div className="sm:col-span-2"><span className="text-slate-500">Change:</span> {r.changeNote}</div>}
              {r.reason && <div className="sm:col-span-2"><span className="text-slate-500">Cancellation Reason:</span> {r.reason}</div>}
            </>
          )}
          {!isPO && r.description && !isBudget && <div className="sm:col-span-2"><span className="text-slate-500">Description:</span> {r.description}</div>}
          {!isPO && r.scope && <div className="sm:col-span-2"><span className="text-slate-500">Scope:</span> {r.scope}</div>}
          {r.justification && <div className="sm:col-span-2"><span className="text-slate-500">Justification:</span> {r.justification}</div>}
          {r.expectedOutcome && <div className="sm:col-span-2"><span className="text-slate-500">Expected:</span> {r.expectedOutcome}</div>}
          {r.rdType && <div><span className="text-slate-500">R&D Type:</span> {r.rdType}</div>}
          {!isPO && r.reason && <div className="sm:col-span-2"><span className="text-slate-500">Reason:</span> {r.reason}</div>}
          {!isBudget && !isPO && r.purpose && <div className="sm:col-span-2"><span className="text-slate-500">Purpose:</span> {r.purpose}</div>}
          {r.linkedPONumber && <div className="sm:col-span-2 bg-fuchsia-50 p-2 rounded border border-fuchsia-200"><span className="text-fuchsia-900 font-semibold">Linked PO:</span> <span className="font-mono">{r.linkedPONumber}</span></div>}
          {r.clientOrderValue > 0 && <div><span className="text-slate-500">Client Order:</span> ₹{(r.clientOrderValue / 100000).toFixed(2)}L</div>}
          {r.startDate && <div><span className="text-slate-500">Start:</span> {r.startDate}</div>}
          {r.endDate && <div><span className="text-slate-500">End:</span> {r.endDate}</div>}
          {r.invoiceNumber && <div><span className="text-slate-500">Invoice:</span> <span className="font-mono">{r.invoiceNumber}</span></div>}
          {r.travelFrom && <div><span className="text-slate-500">From:</span> {r.travelFrom}</div>}
          {r.travelTo && <div><span className="text-slate-500">To:</span> {r.travelTo}</div>}
          {r.travelDates && <div><span className="text-slate-500">Dates:</span> {r.travelDates}</div>}
          {r.attachment && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Attachment:</span>{" "}
              <button onClick={() => setViewAttachment(r.attachment)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 underline font-medium"><Paperclip className="w-3 h-3" />{r.attachment.name}</button>
            </div>
          )}
          {r.paymentProof && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Payment Proof:</span>{" "}
              <button onClick={() => setViewAttachment(r.paymentProof)} className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 underline font-medium"><Paperclip className="w-3 h-3" />{r.paymentProof.name}</button>
            </div>
          )}
          {r.paymentUTR && (
            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded p-2">
              <span className="text-emerald-900 font-semibold">Payment Details:</span>
              <div className="text-xs text-emerald-800 mt-1">
                {r.paymentUTR && <div>UTR: <span className="font-mono">{r.paymentUTR}</span></div>}
                {r.paymentMode && <div>Mode: {r.paymentMode}</div>}
                {r.paymentDate && <div>Date: {r.paymentDate}</div>}
                {r.paidBy && <div>Paid by: {r.paidBy}</div>}
              </div>
            </div>
          )}
          {r.selectedApprovers && r.selectedApprovers.length > 0 && <div className="sm:col-span-2"><span className="text-slate-500">Approvers:</span> {r.selectedApprovers.map(id => getRoster().find(u => u.id === id)?.name).filter(Boolean).join(" + ")}</div>}
        </div>
      </div>
      {isPOEdit && originalPO && (
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Edit3 className="w-3 h-3" />Changes (Old vs New)</div>
          <div className="bg-slate-50 rounded-lg p-2 text-xs">
            <div className="grid grid-cols-3 gap-1 font-semibold text-slate-600 pb-1 border-b border-slate-200">
              <div>Field</div><div>Current (v{originalPO.version || 1})</div><div>Proposed</div>
            </div>
            {(() => {
              const fields = [
                { key: "supplierName", label: "Supplier" },
                { key: "supplierAddress", label: "Address" },
                { key: "supplierGST", label: "GSTIN" },
                { key: "isInternational", label: "International?", format: v => v ? "Yes" : "No" },
                { key: "amountINR", label: "Grand Total (INR)", format: v => "₹" + ((v || 0) / 100000).toFixed(2) + "L" },
                { key: "subtotal", label: "Subtotal", format: v => "₹" + ((v || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 }) },
                { key: "totalGST", label: "Total GST", format: v => "₹" + ((v || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 }) },
                { key: "scope", label: "Scope" },
                { key: "deliveryTimeline", label: "Delivery" },
                { key: "paymentTerms", label: "Terms" },
              ];
              return fields.map(f => {
                const oldVal = originalPO[f.key] ?? "—";
                const newVal = r[f.key] ?? "—";
                const changed = String(oldVal) !== String(newVal);
                const fmt = f.format || (v => v);
                return (
                  <div key={f.key} className={`grid grid-cols-3 gap-1 py-1 border-b border-slate-100 last:border-0 ${changed ? "bg-amber-50 -mx-2 px-2" : ""}`}>
                    <div className="text-slate-500">{f.label}{changed && " ✏️"}</div>
                    <div className={`${changed ? "text-slate-700 line-through" : ""} break-words`}>{fmt(oldVal)}</div>
                    <div className={`${changed ? "text-emerald-700 font-semibold" : ""} break-words`}>{fmt(newVal)}</div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Line items diff */}
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-700 mb-1">Line Items Comparison</div>
            <div className="grid md:grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded p-2">
                <div className="text-xs font-semibold text-slate-600 mb-1">Current ({(originalPO.lineItems || []).length} lines)</div>
                {(originalPO.lineItems || []).length === 0 ? <div className="text-xs text-slate-400 italic">No line items</div> : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">GST</th></tr></thead>
                    <tbody>
                      {originalPO.lineItems.map((li, i) => <tr key={i} className="border-t border-slate-200"><td className="py-0.5">{li.description}</td><td className="text-right">{li.qty} {li.unit}</td><td className="text-right">{parseFloat(li.unitCost).toLocaleString("en-IN")}</td><td className="text-right">{li.gstPct}%</td></tr>)}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-emerald-50 rounded p-2">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Proposed ({(r.lineItems || []).length} lines)</div>
                {(r.lineItems || []).length === 0 ? <div className="text-xs text-slate-400 italic">No line items</div> : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">GST</th></tr></thead>
                    <tbody>
                      {r.lineItems.map((li, i) => <tr key={i} className="border-t border-emerald-200"><td className="py-0.5">{li.description}</td><td className="text-right">{li.qty} {li.unit}</td><td className="text-right">{parseFloat(li.unitCost).toLocaleString("en-IN")}</td><td className="text-right">{li.gstPct}%</td></tr>)}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {r.editReason && <div className="mt-2 text-xs"><span className="text-slate-500">Reason:</span> {r.editReason}</div>}
          {r.changeNote && <div className="mt-1 text-xs italic">"{r.changeNote}"</div>}
        </div>
      )}
      {r.editHistory && r.editHistory.length > 0 && (
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><History className="w-3 h-3" />Edit History</div>
          <div className="space-y-1">
            {r.editHistory.map((eh, i) => (
              <div key={i} className="bg-slate-50 rounded p-2 text-xs">
                <div className="font-semibold">v{eh.version} · {new Date(eh.at).toLocaleString("en-IN", { day: "numeric", month: "short" })} · By {eh.by}</div>
                {eh.changeNote && <div className="italic">"{eh.changeNote}"</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Approval History ({r.history?.length || 0})</div>
        <div className="space-y-1.5">
          {(r.history || []).map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${h.action.includes("Reject") ? "bg-red-100 text-red-600" : ["Paid", "Active", "Approved"].includes(h.action) ? "bg-emerald-100 text-emerald-600" : h.action === "Cancelled" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-600"}`}>
                {h.action.includes("Reject") ? <XCircle className="w-3 h-3" /> : h.action === "Cancelled" ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{h.action}</div>
                <div className="text-slate-600">By {h.by} · {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                {h.comments && <div className="text-slate-500 italic mt-0.5">"{h.comments}"</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
