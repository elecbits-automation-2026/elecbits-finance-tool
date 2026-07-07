import { useState } from "react";
import { FileText } from "lucide-react";
import { RequestCard } from "./RequestCard";
import { NewPaymentRequestForm } from "../forms/NewPaymentRequestForm";
import { NewBudgetRequestForm } from "../forms/NewBudgetRequestForm";
import { NewPORequestForm } from "../forms/NewPORequestForm";
import { NewPIRequestForm } from "../forms/NewPIRequestForm";
import { PostTravelForm } from "../forms/PostTravelForm";

// ============ REQUEST LIST ============
export function RequestList({ requests, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter, savePICounter, poCounter, piCounter, suppliers = [], saveSuppliers, emptyMessage, showActions = false, showCancelResubmit = false, addNotifications, showToast }) {
  const [expanded, setExpanded] = useState(null);
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [reviseTarget, setReviseTarget] = useState(null);
  const [postTravelTarget, setPostTravelTarget] = useState(null);

  if (resubmitTarget) {
    return (
      <div>
        <button onClick={() => setResubmitTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back</button>
        <NewPaymentRequestForm user={user} requests={requests_all} budgets={budgets_all} pos={pos_all} saveRequests={saveRequests} onSuccess={() => setResubmitTarget(null)} resubmitFrom={resubmitTarget} />
      </div>
    );
  }

  if (reviseTarget) {
    const back = <button onClick={() => setReviseTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back</button>;
    let form = null;
    if (reviseTarget.kind === "Payment") {
      form = <NewPaymentRequestForm user={user} requests={requests_all} budgets={budgets_all} pos={pos_all} saveRequests={saveRequests} onSuccess={() => setReviseTarget(null)} resubmitFrom={reviseTarget} />;
    } else if (reviseTarget.kind === "Budget") {
      form = <NewBudgetRequestForm user={user} budgets={budgets_all} requests={requests_all} saveBudgets={saveBudgets} addNotifications={addNotifications} showToast={showToast} onSuccess={() => setReviseTarget(null)} reviseFrom={reviseTarget} />;
    } else if (reviseTarget.kind === "PO") {
      form = <NewPORequestForm user={user} budgets={budgets_all} pos={pos_all} requests={requests_all} suppliers={suppliers} savePOs={savePOs} saveSuppliers={saveSuppliers} onSuccess={() => setReviseTarget(null)} reviseFrom={reviseTarget} />;
    } else if (reviseTarget.kind === "PI") {
      form = <NewPIRequestForm user={user} budgets={budgets_all} pos={pos_all} requests={requests_all} savePOs={savePOs} onSuccess={() => setReviseTarget(null)} reviseFrom={reviseTarget} />;
    }
    return <div>{back}{form}</div>;
  }

  if (postTravelTarget) {
    return (
      <div>
        <button onClick={() => setPostTravelTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back</button>
        <PostTravelForm request={postTravelTarget} user={user} requests_all={requests_all} saveRequests={saveRequests} onDone={() => setPostTravelTarget(null)} />
      </div>
    );
  }

  if (requests.length === 0) return <div className="bg-white rounded-xl border border-slate-200 p-10 text-center"><FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 text-sm">{emptyMessage}</p></div>;

  return (
    <div className="space-y-2">
      {requests.map(r => <RequestCard key={r.id} request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} savePICounter={savePICounter} poCounter={poCounter} piCounter={piCounter} expanded={expanded === r.id} setExpanded={setExpanded} showActions={showActions} showCancelResubmit={showCancelResubmit} onResubmit={() => setResubmitTarget(r)} onRevise={() => setReviseTarget(r)} onFillPostTravel={() => setPostTravelTarget(r)} addNotifications={addNotifications} showToast={showToast} />)}
    </div>
  );
}
