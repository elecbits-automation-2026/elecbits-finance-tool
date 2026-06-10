import { useState } from "react";
import { Wallet, FileSignature, PiggyBank, CheckCircle2, XCircle } from "lucide-react";
import { getUserActionsOnRequest } from "../lib/access";
import { RequestList } from "../requests/RequestList";

// ============ MY APPROVALS ============
export function MyApprovalsView({ user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, addNotifications, showToast }) {
  const [typeTab, setTypeTab] = useState("payment");
  const [filter, setFilter] = useState("all");

  const allItems = typeTab === "payment" ? requests : typeTab === "budget" ? budgets : pos;
  const myActionItems = allItems.filter(r => {
    const a = getUserActionsOnRequest(user, r);
    return a.approvals.length > 0 || a.rejections.length > 0;
  });

  const filtered = myActionItems.filter(r => {
    const a = getUserActionsOnRequest(user, r);
    if (filter === "approved") return a.approvals.length > 0 && a.rejections.length === 0;
    if (filter === "rejected") return a.rejections.length > 0;
    return true;
  });

  const approvedCount = myActionItems.filter(r => { const a = getUserActionsOnRequest(user, r); return a.approvals.length > 0 && a.rejections.length === 0; }).length;
  const rejectedCount = myActionItems.filter(r => getUserActionsOnRequest(user, r).rejections.length > 0).length;

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTypeTab("payment")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${typeTab === "payment" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><Wallet className="w-4 h-4 inline mr-1" />Payments</button>
        <button onClick={() => setTypeTab("po")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${typeTab === "po" ? "bg-fuchsia-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><FileSignature className="w-4 h-4 inline mr-1" />POs</button>
        <button onClick={() => setTypeTab("budget")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${typeTab === "budget" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><PiggyBank className="w-4 h-4 inline mr-1" />Budgets</button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === "all" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>All ({myActionItems.length})</button>
        <button onClick={() => setFilter("approved")} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === "approved" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><CheckCircle2 className="w-3 h-3 inline mr-0.5" />Approved ({approvedCount})</button>
        <button onClick={() => setFilter("rejected")} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === "rejected" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><XCircle className="w-3 h-3 inline mr-0.5" />Rejected ({rejectedCount})</button>
      </div>
      <RequestList
        requests={filtered.sort((a, b) => {
          const aA = getUserActionsOnRequest(user, a).all[0];
          const bA = getUserActionsOnRequest(user, b).all[0];
          return +new Date(bA?.at || 0) - +new Date(aA?.at || 0);
        })}
        user={user} requests_all={requests} budgets_all={budgets} pos_all={pos}
        saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter}
        emptyMessage={`You haven't ${filter === "all" ? "acted on any" : filter} ${typeTab} requests yet.`}
        addNotifications={addNotifications} showToast={showToast}
      />
    </div>
  );
}
