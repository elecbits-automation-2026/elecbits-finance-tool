import { useState } from "react";
import { Users, Coins, ClipboardCheck, Wallet, Plane } from "lucide-react";
import { HR_EXPENSE_NAMES } from "../constants";
import { StatCards } from "../components/StatCards";
import { RequestList } from "../requests/RequestList";

// HR-only, org-wide view of the HR expense categories (people + office/admin ops).
// Read-only. The DB grants HR read of exactly these categories via requests_select
// (migration 0027); the client filter mirrors HR_EXPENSE_NAMES.
export function HRExpensesView({ user, requests, budgets, pos, saveRequests, saveBudgets, savePOs, addNotifications, showToast }) {
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [q, setQ] = useState("");

  const all = requests.filter(r => r.kind === "Payment" && HR_EXPENSE_NAMES.includes(r.expenseTypeName));
  const totalINR = all.filter(r => !["Rejected", "Cancelled"].includes(r.status)).reduce((s, r) => s + (r.amountINR || 0), 0);
  const travelAccom = all.filter(r => r.travel).length;
  const pendingOutcomes = all.filter(r => r.travel?.subType === "Travel" && r.status === "Paid" && !r.postTravel).length;

  const statuses = ["All", ...Array.from(new Set(all.map(r => r.status)))];
  const filtered = all
    .filter(r => catFilter === "All" || r.expenseTypeName === catFilter)
    .filter(r => statusFilter === "All" || r.status === statusFilter)
    .filter(r => !q.trim() || `${r.requesterName} ${r.dept} ${r.description} ${r.expenseTypeName}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => +new Date(b.createdDate) - +new Date(a.createdDate));

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">Org Expenses — All Users</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Org-wide view of these categories: {HR_EXPENSE_NAMES.join(", ")}.</p>

      <StatCards items={[
        { label: "Total Items", value: all.length, color: "blue", icon: Wallet },
        { label: "Total (excl. rej/canc)", value: `₹${(totalINR / 100000).toFixed(2)}L`, color: "emerald", icon: Coins },
        { label: "Travel / Accom", value: travelAccom, color: "indigo", icon: Plane },
        { label: "Pending Outcome", value: pendingOutcomes, color: "amber", icon: ClipboardCheck },
      ]} />

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="All">All categories</option>
          {HR_EXPENSE_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          {statuses.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / dept / category / description" className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[200px]" />
        <div className="text-xs text-slate-500 self-center">{filtered.length} of {all.length}</div>
      </div>

      <RequestList requests={filtered} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} emptyMessage="No HR expense requests found." addNotifications={addNotifications} showToast={showToast} />
    </div>
  );
}
