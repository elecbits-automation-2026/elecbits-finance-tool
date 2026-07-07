import { useState } from "react";
import { Edit3, History, XCircle, CheckCircle2, Ban, Paperclip, Undo2 } from "lucide-react";
import { CURRENCIES } from "../constants";
import { getRoster } from "../lib/roster";
import { AttachmentViewer } from "../components/AttachmentViewer";

export function RequestDetails({ request: r, pos_all, requests_all = [] }) {
  const [viewAttachment, setViewAttachment] = useState(null);
  // Linked trip expenses: what this record points to (forward) + anything pointing
  // back at it (reverse), so the Travel↔Accommodation link shows from either side.
  const linkedTrips = r.travel
    ? [
        ...(r.travel.linkedTripId ? requests_all.filter(x => x.id === r.travel.linkedTripId) : []),
        ...requests_all.filter(x => x.travel?.linkedTripId === r.id),
      ].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i)
    : [];
  const isBudget = r.kind === "Budget";
  const isPO = r.kind === "PO";
  const isPI = r.kind === "PI";
  const isPOorPI = isPO || isPI;
  // A PI mirrors a PO; the optional inner reference points at a PO (hasPO/poNumber)
  // rather than a PI (hasPI/piNumber).
  const refHas = isPI ? r.hasPO : r.hasPI;
  const refLabel = isPI ? "Client PO" : "Vendor Proforma";
  const refIcon = isPI ? "📄" : "🧾";
  const refNumber = isPI ? r.poNumber : r.piNumber;
  const refGstPct = isPI ? r.poGstPct : r.piGstPct;
  const isDocEdit = (isPO && r.type === "POEdit") || (isPI && r.type === "PIEdit");
  const editingDocId = isPI ? r.editingPIId : r.editingPOId;
  const originalDoc = isDocEdit && pos_all ? pos_all.find(p => p.id === editingDocId) : null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {viewAttachment && <AttachmentViewer attachment={viewAttachment} onClose={() => setViewAttachment(null)} />}
      {(r.status === "Returned for Changes" || r.revisionRound > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs space-y-1">
          {r.status === "Returned for Changes" && (
            <div><span className="font-bold text-amber-900">Returned for changes{r.returnedBy ? ` by ${r.returnedBy}` : ""}:</span>{r.returnRemarks ? <span className="italic text-amber-800"> "{r.returnRemarks}"</span> : null}</div>
          )}
          {r.revisionRound > 0 && (
            <div><span className="font-bold text-amber-900">Re-requested — round {r.revisionRound}.</span>{r.revisionNote ? <span className="italic text-amber-800"> Change asked: "{r.revisionNote}".</span> : null}{r.revisedFrom ? <span className="text-amber-700"> Supersedes <span className="font-mono">{r.revisedFrom}</span>.</span> : null}</div>
          )}
        </div>
      )}
      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Details</div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {isPOorPI && (
            <>
              <div className="sm:col-span-2"><span className="text-slate-500">{isPI ? "Client" : "Supplier"}:</span> <strong>{r.supplierName}</strong></div>
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
              {refHas && (
                <div className="sm:col-span-2 bg-teal-50 rounded p-2 border border-teal-200">
                  <div className="text-xs font-bold text-teal-900 mb-1">{refIcon} {refLabel}{refNumber ? ` · ${refNumber}` : ""}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    {(r.totalGST || 0) > 0 ? (
                      <>
                        <span>Subtotal: <strong>{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                        <span>GST{refGstPct != null ? ` (${refGstPct}%)` : ""}: <strong>{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                        <span className="text-teal-900">Grand Total: <strong>{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                      </>
                    ) : (
                      <span className="text-teal-900">Total Amount: <strong>{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                    )}
                  </div>
                </div>
              )}
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
              {Array.isArray(r.receipts) && r.receipts.length > 0 && (
                <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                  <div className="text-xs font-bold text-emerald-900 mb-1">💰 Receipts ({r.receipts.length}) — ₹{(r.receipts.reduce((s, x) => s + (x.amountINR || 0), 0) / 100000).toFixed(2)}L received of ₹{((r.amountINR || 0) / 100000).toFixed(2)}L billed</div>
                  {r.receipts.map((rc, i) => (
                    <div key={rc.id || i} className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-semibold">₹{((rc.amountINR || 0) / 100000).toFixed(2)}L</span>
                      {rc.date && <span className="text-slate-500">{rc.date}</span>}
                      {rc.mode && <span className="text-slate-500">{rc.mode}</span>}
                      {rc.reference && <span className="font-mono text-slate-600">{rc.reference}</span>}
                      <span className="text-slate-400">by {rc.receivedBy}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {!isPOorPI && r.description && !isBudget && <div className="sm:col-span-2"><span className="text-slate-500">Description:</span> {r.description}</div>}
          {!isPOorPI && r.scope && <div className="sm:col-span-2"><span className="text-slate-500">Scope:</span> {r.scope}</div>}
          {r.justification && <div className="sm:col-span-2"><span className="text-slate-500">Justification:</span> {r.justification}</div>}
          {r.expectedOutcome && <div className="sm:col-span-2"><span className="text-slate-500">Expected:</span> {r.expectedOutcome}</div>}
          {r.rdType && <div><span className="text-slate-500">R&D Type:</span> {r.rdType}</div>}
          {!isPOorPI && r.reason && <div className="sm:col-span-2"><span className="text-slate-500">Reason:</span> {r.reason}</div>}
          {!isBudget && !isPOorPI && r.purpose && <div className="sm:col-span-2"><span className="text-slate-500">Purpose:</span> {r.purpose}</div>}
          {r.linkedPONumber && <div className="sm:col-span-2 bg-fuchsia-50 p-2 rounded border border-fuchsia-200"><span className="text-fuchsia-900 font-semibold">Linked PO:</span> <span className="font-mono">{r.linkedPONumber}</span></div>}
          {Array.isArray(r.splits) && r.splits.length > 0 && (
            <div className="sm:col-span-2 bg-indigo-50 p-2 rounded border border-indigo-200">
              <div className="text-indigo-900 font-semibold mb-1">Project split (one supplier, {r.splits.length} projects)</div>
              {r.splits.map((s, i) => (
                <div key={i} className="flex justify-between gap-2"><span className="font-mono">{s.projectId}{s.projectName ? ` — ${s.projectName}` : ""}{s.linkedPONumber ? ` · PO ${s.linkedPONumber}` : ""}</span><span className="font-semibold whitespace-nowrap">₹{((s.amountINR || 0) / 100000).toFixed(2)}L</span></div>
              ))}
            </div>
          )}
          {r.clientOrderValue > 0 && <div><span className="text-slate-500">Client Order:</span> ₹{(r.clientOrderValue / 100000).toFixed(2)}L</div>}
          {r.startDate && <div><span className="text-slate-500">Start:</span> {r.startDate}</div>}
          {r.endDate && <div><span className="text-slate-500">End:</span> {r.endDate}</div>}
          {r.invoiceNumber && <div><span className="text-slate-500">Invoice:</span> <span className="font-mono">{r.invoiceNumber}</span></div>}
          {r.travelFrom && <div><span className="text-slate-500">From:</span> {r.travelFrom}</div>}
          {r.travelTo && <div><span className="text-slate-500">To:</span> {r.travelTo}</div>}
          {r.travelDates && <div><span className="text-slate-500">Dates:</span> {r.travelDates}</div>}
          {r.travel && (
            <div className="sm:col-span-2 bg-sky-50 border border-sky-200 rounded p-2 space-y-1">
              <div className="text-xs font-bold text-sky-900">{r.travel.subType === "Accommodation" ? "🏨 Accommodation" : "✈️ Travel"} details</div>
              {r.travel.subType === "Accommodation" ? (
                <>
                  {r.travel.place && <div><span className="text-slate-500">Location:</span> {r.travel.place}</div>}
                  {(r.travel.checkIn || r.travel.checkOut) && <div><span className="text-slate-500">Stay:</span> {r.travel.checkIn} → {r.travel.checkOut}{r.travel.nights ? ` (${r.travel.nights} night${r.travel.nights > 1 ? "s" : ""})` : ""}</div>}
                  {r.travel.dailyCap != null && <div><span className="text-slate-500">Cap:</span> ₹{Number(r.travel.dailyCap).toLocaleString("en-IN")}/night{r.travel.nights ? ` · ₹${(r.travel.dailyCap * r.travel.nights).toLocaleString("en-IN")} max` : ""}</div>}
                  {r.travel.capOverrideJustification && <div><span className="text-red-700 font-semibold">Over-cap:</span> {r.travel.capOverrideJustification}</div>}
                  {r.travel.urgent && <div><span className="text-amber-700 font-semibold">Urgent</span> ({r.travel.leadDays}d notice){r.travel.urgencyJustification ? `: ${r.travel.urgencyJustification}` : ""}</div>}
                </>
              ) : (
                <>
                  {(r.travel.fullName || r.travel.contactNumber || r.travel.email) && <div><span className="text-slate-500">Traveller:</span> {r.travel.fullName}{r.travel.contactNumber ? ` · ${r.travel.contactNumber}` : ""}{r.travel.email ? ` · ${r.travel.email}` : ""}</div>}
                  {r.travel.tripType && <div><span className="text-slate-500">Trip type:</span> {r.travel.tripType}</div>}
                  {r.travel.pnr && <div><span className="text-slate-500">Flight PNR:</span> {r.travel.pnr}</div>}
                  {(r.travel.departureCity || r.travel.arrivalCity || r.travel.fromLocation) && <div><span className="text-slate-500">Route:</span> {r.travel.departureCity || r.travel.fromLocation} → {r.travel.arrivalCity || r.travel.toLocation}</div>}
                  {(r.travel.departureDate || r.travel.startDate) && <div><span className="text-slate-500">Departure:</span> {r.travel.departureDate || r.travel.startDate}{r.travel.departureFlightTime ? ` (${r.travel.departureFlightTime})` : ""}</div>}
                  {(r.travel.returnDate || r.travel.endDate) && <div><span className="text-slate-500">Return:</span> {r.travel.returnDate || r.travel.endDate}{r.travel.returnFlightTime ? ` (${r.travel.returnFlightTime})` : ""}</div>}
                  {Array.isArray(r.travel.reasons) && r.travel.reasons.length > 0 && <div><span className="text-slate-500">Reason:</span> {r.travel.reasons.filter(x => x !== "Other").concat(r.travel.reasonOther ? [r.travel.reasonOther] : []).join(", ")}</div>}
                  {r.travel.isEmergency === "Yes" && <div><span className="text-amber-700 font-semibold">Emergency travel</span>{r.travel.leadDays != null ? ` (${r.travel.leadDays}d notice)` : ""}{r.travel.emergencyReason ? `: ${r.travel.emergencyReason}` : ""}</div>}
                  {r.travel.meetingsCount != null && r.travel.meetingsCount !== "" && <div><span className="text-slate-500">Meetings aligned:</span> {r.travel.meetingsCount}</div>}
                  {Array.isArray(r.travel.meetings) && r.travel.meetings.length > 0 && (
                    <div>{r.travel.meetings.map((m, i) => <div key={i} className="ml-2">• {m.orgName}{m.meetingWith ? ` — with ${m.meetingWith}` : ""}</div>)}</div>
                  )}
                  {r.travel.peopleCount != null && r.travel.peopleCount !== "" && <div><span className="text-slate-500">People travelling (excl. requester):</span> {r.travel.peopleCount}</div>}
                  {r.travel.desiredOutcomes && <div><span className="text-slate-500">Desired outcomes:</span> {r.travel.desiredOutcomes}</div>}
                </>
              )}
              {r.travel.overshootJustification && <div><span className="text-red-700 font-semibold">Over-budget:</span> {r.travel.overshootJustification}</div>}
              {linkedTrips.length > 0 && (
                <div className="pt-1 border-t border-sky-200">
                  <span className="text-slate-500">🔗 Linked trip expense{linkedTrips.length > 1 ? "s" : ""}:</span>
                  {linkedTrips.map(x => <div key={x.id} className="ml-2">{x.travel?.subType} · <span className="font-mono">{x.id}</span> · {x.description} · <span className="text-slate-500">{x.status}</span></div>)}
                </div>
              )}
              {Array.isArray(r.travel.travellers) && r.travel.travellers.length > 0 && (
                <div>
                  <div className="text-slate-500">Additional travellers ({r.travel.travellers.length}):</div>
                  {r.travel.travellers.map((t, i) => <div key={i} className="ml-2">• {t.name || t.fullName} ({t.age}, {t.sex})</div>)}
                </div>
              )}
            </div>
          )}
          {r.postTravel && (
            <div className="sm:col-span-2 bg-teal-50 border border-teal-200 rounded p-2 space-y-1">
              <div className="text-xs font-bold text-teal-900">📝 Travel Outcome</div>
              {r.postTravel.objectiveAchieved && <div><span className="text-slate-500">Objective achieved:</span> <strong>{r.postTravel.objectiveAchieved}</strong></div>}
              {r.postTravel.destinationCity && <div><span className="text-slate-500">Destination:</span> {r.postTravel.destinationCity}</div>}
              {r.postTravel.flightPNR && <div><span className="text-slate-500">Flight PNR:</span> {r.postTravel.flightPNR}</div>}
              {r.postTravel.purpose && <div><span className="text-slate-500">Purpose:</span> {r.postTravel.purpose}</div>}
              {r.postTravel.meetingsCompleted != null && r.postTravel.meetingsCompleted !== "" && <div><span className="text-slate-500">Meetings completed:</span> {r.postTravel.meetingsCompleted}</div>}
              {r.postTravel.keyOutcomes && <div><span className="text-slate-500">Key outcomes:</span> {r.postTravel.keyOutcomes}</div>}
              {r.postTravel.expectedOrderDate && <div><span className="text-slate-500">Expected order date:</span> {r.postTravel.expectedOrderDate}</div>}
              {r.postTravel.followUpActions && <div><span className="text-slate-500">Follow-up:</span> {r.postTravel.followUpActions}</div>}
              {r.postTravel.remarks && <div><span className="text-slate-500">Remarks:</span> {r.postTravel.remarks}</div>}
              {(r.postTravel.boardingPass || r.postTravel.receipt) && (
                <div>
                  <span className="text-slate-500">Boarding pass:</span>{" "}
                  <button onClick={() => setViewAttachment(r.postTravel.boardingPass || r.postTravel.receipt)} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 underline font-medium"><Paperclip className="w-3 h-3" />{(r.postTravel.boardingPass || r.postTravel.receipt).name}</button>
                </div>
              )}
              {r.postTravel.filedBy && <div className="text-slate-400">Filed by {r.postTravel.filedBy}{r.postTravel.filedAt ? ` · ${new Date(r.postTravel.filedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}</div>}
            </div>
          )}
          {r.attachment && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Attachment:</span>{" "}
              <button onClick={() => setViewAttachment(r.attachment)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 underline font-medium"><Paperclip className="w-3 h-3" />{r.attachment.name}</button>
            </div>
          )}
          {r.paymentInvoice && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Invoice / Bill:</span>{" "}
              <button onClick={() => setViewAttachment(r.paymentInvoice)} className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 underline font-medium"><Paperclip className="w-3 h-3" />{r.paymentInvoice.name}</button>
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
      {isDocEdit && originalDoc && (
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Edit3 className="w-3 h-3" />Changes (Old vs New)</div>
          <div className="bg-slate-50 rounded-lg p-2 text-xs">
            <div className="grid grid-cols-3 gap-1 font-semibold text-slate-600 pb-1 border-b border-slate-200">
              <div>Field</div><div>Current (v{originalDoc.version || 1})</div><div>Proposed</div>
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
                const oldVal = originalDoc[f.key] ?? "—";
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
                <div className="text-xs font-semibold text-slate-600 mb-1">Current ({(originalDoc.lineItems || []).length} lines)</div>
                {(originalDoc.lineItems || []).length === 0 ? <div className="text-xs text-slate-400 italic">No line items</div> : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">GST</th></tr></thead>
                    <tbody>
                      {originalDoc.lineItems.map((li, i) => <tr key={i} className="border-t border-slate-200"><td className="py-0.5">{li.description}</td><td className="text-right">{li.qty} {li.unit}</td><td className="text-right">{parseFloat(li.unitCost).toLocaleString("en-IN")}</td><td className="text-right">{li.gstPct}%</td></tr>)}
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
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${h.action.includes("Reject") ? "bg-red-100 text-red-600" : h.action.includes("Return") ? "bg-amber-100 text-amber-700" : ["Paid", "Active", "Approved"].includes(h.action) ? "bg-emerald-100 text-emerald-600" : h.action === "Cancelled" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-600"}`}>
                {h.action.includes("Reject") ? <XCircle className="w-3 h-3" /> : h.action.includes("Return") ? <Undo2 className="w-3 h-3" /> : h.action === "Cancelled" ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
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
