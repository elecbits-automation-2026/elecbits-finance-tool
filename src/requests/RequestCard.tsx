import { FileSignature, PiggyBank, Wallet, Paperclip, Eye, RotateCcw } from "lucide-react";
import { CURRENCIES } from "../constants";
import { ActionButtons } from "./ActionButtons";
import { CancelButton } from "./CancelButton";
import { RequestDetails } from "./RequestDetails";

export function RequestCard({ request: r, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter = undefined, poCounter = undefined, expanded, setExpanded, showActions = false, showCancelResubmit = false, onResubmit = undefined, addNotifications = undefined, showToast = undefined }) {
  const isBudget = r.kind === "Budget";
  const isPO = r.kind === "PO";

  const statusColor = {
    "Pending Delivery Head (Arun)": "cyan", "Pending Delivery Head": "cyan",
    "Pending Dept Approval": "blue", "Pending Dept Head": "blue",
    "Pending VP": "violet", "Pending CEO": "amber", "Pending Stuti + Sarthak": "fuchsia",
    "Pending Finance Head": "indigo",
    "Pending Accountant Processing": "teal", "Pending PO Number Assignment": "teal",
    "Processing Payment": "blue",
    "Paid": "emerald", "Active Budget": "emerald", "Active": "emerald", "Approved": "emerald",
    "Rejected": "red", "Cancelled": "slate", "Closed": "slate",
  }[r.status] || "slate";

  const canCancel = showCancelResubmit && r.requesterId === user.id && !["Paid", "Rejected", "Cancelled", "Active", "Approved", "Closed"].includes(r.status) && r.currentStage !== "Processing";
  const canResubmit = showCancelResubmit && r.requesterId === user.id && r.status === "Rejected" && r.kind === "Payment";

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isPO ? "border-fuchsia-200" : isBudget ? "border-indigo-200" : "border-slate-200"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isPO ? "bg-fuchsia-100 text-fuchsia-700" : isBudget ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"}`}>
                {isPO ? <><FileSignature className="w-3 h-3 inline mr-0.5" />PO {r.type === "POEdit" ? "Edit" : r.type === "POCancel" ? "Cancel" : ""}</> : isBudget ? <><PiggyBank className="w-3 h-3 inline mr-0.5" />{r.type} Budget</> : <><Wallet className="w-3 h-3 inline mr-0.5" />Payment</>}
              </span>
              {isPO && r.poNumber && <span className="font-mono text-xs font-bold text-fuchsia-900">{r.poNumber}</span>}
              {isPO && r.version > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">v{r.version}</span>}
              <span className="font-mono text-xs text-slate-500">{r.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold bg-${statusColor}-100 text-${statusColor}-700`}>{r.status}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{r.dept}</span>
              {!isBudget && !isPO && <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{r.expenseTypeName}</span>}
              {r.isProject && <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Project</span>}
              {r.linkedPONumber && <span className="text-xs px-2 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 font-mono">{r.linkedPONumber}</span>}
              {r.currency && r.currency !== "INR" && <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">{r.currency}</span>}
              {r.resubmittedFrom && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Resubmitted</span>}
              {r.attachment && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 flex items-center gap-0.5"><Paperclip className="w-3 h-3" /></span>}
            </div>
            <div className="font-semibold text-slate-900 text-sm">
              {isPO ? (r.type === "POEdit" ? `Edit: ${r.editingPONumber} — ${r.supplierName}` : r.type === "POCancel" ? `Cancel: ${r.cancellingPONumber}` : `${r.supplierName}`) :
               isBudget ? `${r.projectName || r.category || "Extension"} ${r.projectId ? `(${r.projectId})` : ""}` :
               r.description}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              By <strong>{r.requesterName}</strong> · {new Date(r.createdDate || r.approvedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {r.vendor && <> · {r.vendor}</>}
              {r.client && r.projectType !== "RD" && <> · Client: {r.client}</>}
              {isPO && r.isProject && <> · Project: {r.projectId}</>}
              {isPO && !r.isProject && r.category && <> · {r.category}</>}
            </div>
          </div>
          <div className="text-right">
            {r.currency && r.currency !== "INR" ? (
              <>
                <div className="text-sm font-semibold text-slate-700">{CURRENCIES.find(c => c.code === r.currency)?.symbol}{r.amount.toLocaleString("en-IN")}</div>
                <div className="text-lg font-bold text-slate-900">₹{r.amountINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-slate-500">@ ₹{r.fxRate}/{r.currency}</div>
              </>
            ) : (
              <div className="text-lg font-bold text-slate-900">₹{(r.amountINR || r.amount || 0).toLocaleString("en-IN")}</div>
            )}
            <button onClick={() => setExpanded(expanded ? null : r.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mt-0.5 ml-auto"><Eye className="w-3 h-3" />{expanded ? "Hide" : "View"}</button>
          </div>
        </div>

        {showActions && <ActionButtons request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} addNotifications={addNotifications} showToast={showToast} />}
        {canCancel && <CancelButton request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} />}
        {canResubmit && <div className="mt-2"><button onClick={onResubmit} className="bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Resubmit with edits</button></div>}

        {expanded && <RequestDetails request={r} pos_all={pos_all} />}
      </div>
    </div>
  );
}
