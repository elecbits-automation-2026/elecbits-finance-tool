import { useState } from "react";
import { FileText } from "lucide-react";
import { RequestCard } from "./RequestCard";
import { NewPaymentRequestForm } from "../forms/NewPaymentRequestForm";

// ============ REQUEST LIST ============
export function RequestList({ requests, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter, poCounter, emptyMessage, showActions = false, showCancelResubmit = false, addNotifications, showToast }) {
  const [expanded, setExpanded] = useState(null);
  const [resubmitTarget, setResubmitTarget] = useState(null);

  if (resubmitTarget) {
    return (
      <div>
        <button onClick={() => setResubmitTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back</button>
        <NewPaymentRequestForm user={user} requests={requests_all} budgets={budgets_all} pos={pos_all} saveRequests={saveRequests} onSuccess={() => setResubmitTarget(null)} resubmitFrom={resubmitTarget} />
      </div>
    );
  }

  if (requests.length === 0) return <div className="bg-white rounded-xl border border-slate-200 p-10 text-center"><FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 text-sm">{emptyMessage}</p></div>;

  return (
    <div className="space-y-2">
      {requests.map(r => <RequestCard key={r.id} request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} expanded={expanded === r.id} setExpanded={setExpanded} showActions={showActions} showCancelResubmit={showCancelResubmit} onResubmit={() => setResubmitTarget(r)} addNotifications={addNotifications} showToast={showToast} />)}
    </div>
  );
}
