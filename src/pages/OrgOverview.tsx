import { useState } from "react";
import { FileText, CheckCircle2, Clock, PiggyBank } from "lucide-react";
import { filterByAccess } from "../lib/access";
import { StatCards } from "../components/StatCards";
import { DrillDownModal } from "../requests/DrillDownModal";

// ============ ORG OVERVIEW ============
export function OrgOverview({ user, requests, budgets, pos, showToast }) {
  const [drillDown, setDrillDown] = useState(null);
  const visibleRequests = filterByAccess(user, requests);
  const visibleBudgets = filterByAccess(user, budgets);
  const visiblePOs = pos ? filterByAccess(user, pos) : [];

  const total = visibleRequests.length;
  const paidReqs = visibleRequests.filter(r => r.status === "Paid");
  const pendingReqs = visibleRequests.filter(r => !["Paid", "Rejected", "Cancelled"].includes(r.status));
  const totalPaidINR = paidReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);
  const totalPendingINR = pendingReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);

  const clientBudgets = visibleBudgets.filter(b => b.type === "Project" && b.projectType === "Client" && (b.status === "Active" || b.currentStage === "Active"));
  const rdBudgets = visibleBudgets.filter(b => b.type === "Project" && b.projectType === "RD" && (b.status === "Active" || b.currentStage === "Active"));
  const allActiveBudgets = [...clientBudgets, ...rdBudgets];
  const activeClientBudget = clientBudgets.reduce((s, b) => s + b.amountINR, 0);
  const activeRDBudget = rdBudgets.reduce((s, b) => s + b.amountINR, 0);

  const byDept: Record<string, number> = {};
  visibleRequests.filter(r => r.status === "Paid").forEach(r => { byDept[r.dept] = (byDept[r.dept] || 0) + (r.amountINR || r.amount); });

  function handleCardClick(data, title) {
    if (data.length === 0) { showToast("Nothing here", "info"); return; }
    setDrillDown({ title, data });
  }

  return (
    <div>
      <StatCards items={[
        { label: "Total Payment Reqs", value: total, color: "blue", icon: FileText, onClick: () => handleCardClick(visibleRequests, "All Payments") },
        { label: "Paid (INR)", value: "₹" + (totalPaidINR / 100000).toFixed(1) + "L", color: "emerald", icon: CheckCircle2, onClick: () => handleCardClick(paidReqs, "Paid") },
        { label: "Pending (INR)", value: "₹" + (totalPendingINR / 100000).toFixed(1) + "L", color: "amber", icon: Clock, onClick: () => handleCardClick(pendingReqs, "Pending") },
        { label: "Active Budgets", value: "₹" + ((activeClientBudget + activeRDBudget) / 100000).toFixed(0) + "L", color: "indigo", icon: PiggyBank, onClick: () => handleCardClick(allActiveBudgets, "Active Budgets") },
      ]} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-1">Spend by Department (Paid only)</h3>
          <p className="text-xs text-slate-500 mb-3">Counts only paid amounts. Approved budgets and pending requests are excluded.</p>
          {Object.keys(byDept).length === 0 ? <p className="text-sm text-slate-500">No paid requests yet.</p> : (
            <div className="space-y-2">
              {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([d, amt]) => {
                const deptPaid = visibleRequests.filter(r => r.dept === d && r.status === "Paid");
                return (
                  <button key={d} onClick={() => handleCardClick(deptPaid, `${d} — Paid`)} className="w-full flex justify-between items-center text-sm hover:bg-slate-50 p-1 rounded">
                    <span className="font-medium">{d}</span>
                    <span className="font-bold">₹{(amt / 100000).toFixed(2)}L</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3">Project Margins (Client)</h3>
          {clientBudgets.length === 0 ? <p className="text-sm text-slate-500">None</p> : (
            <div className="space-y-2 text-sm">
              {clientBudgets.map(b => {
                const margin = ((b.clientOrderValue - b.amountINR) / b.clientOrderValue) * 100;
                return <div key={b.id} className="flex justify-between"><span className="text-xs font-mono truncate pr-2">{b.projectId}</span><span className={`font-bold ${margin >= 20 ? "text-emerald-700" : margin >= 10 ? "text-amber-700" : "text-red-700"}`}>{margin.toFixed(1)}%</span></div>;
              })}
            </div>
          )}
        </div>
      </div>

      {drillDown && <DrillDownModal title={drillDown.title} items={drillDown.data} user={user} requests_all={requests} budgets_all={budgets} pos_all={visiblePOs} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
