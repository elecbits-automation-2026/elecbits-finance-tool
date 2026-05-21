import { useState } from "react";
import { PiggyBank, Wallet, TrendingUp } from "lucide-react";

// ============ REPORTS VIEW ============
export function ReportsView({ user, requests, budgets, pos }) {
  const [section, setSection] = useState("budget");
  const activeProjBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));
  const activeMonthlyBudgets = budgets.filter(b => b.type === "Monthly" && (b.status === "Active" || b.currentStage === "Active"));
  const activeExtensions = budgets.filter(b => b.type === "Extension" && (b.status === "Active" || b.currentStage === "Active"));
  const paidReqs = requests.filter(r => r.status === "Paid");
  const clientProjects = activeProjBudgets.filter(b => b.projectType === "Client");
  const rdProjects = activeProjBudgets.filter(b => b.projectType === "RD");
  const rdPaid = paidReqs.filter(r => rdProjects.some(p => p.projectId === r.projectId)).reduce((s, r) => s + (r.amountINR || r.amount), 0);

  function groupSum(list, keyFn, valFn = r => r.amountINR || r.amount) {
    const out = {};
    list.forEach(r => { const k = keyFn(r); if (k) out[k] = (out[k] || 0) + valFn(r); });
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setSection("budget")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === "budget" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><PiggyBank className="w-4 h-4 inline mr-1" />Approved Budgets</button>
        <button onClick={() => setSection("expense")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === "expense" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><Wallet className="w-4 h-4 inline mr-1" />Expenses (Paid)</button>
        <button onClick={() => setSection("pnl")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === "pnl" ? "bg-amber-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><TrendingUp className="w-4 h-4 inline mr-1" />Project P&L</button>
      </div>

      {section === "budget" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-3">Active Project Budgets</h3>
            {[...clientProjects, ...rdProjects].length === 0 && <div className="text-sm text-slate-500">None</div>}
            {[...clientProjects, ...rdProjects].map(b => (
              <div key={b.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold mr-2 ${b.projectType === "RD" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-blue-100 text-blue-700"}`}>{b.projectType === "RD" ? "R&D" : "CLIENT"}</span>
                  <span className="font-mono text-xs">{b.projectId}</span>
                  <span className="ml-2">{b.projectName}</span>
                </div>
                <span className="font-bold">₹{(b.amountINR / 100000).toFixed(2)}L</span>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">By Department</h3>
              {groupSum(activeProjBudgets, b => b.dept).map(([d, v]) => <div key={d} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{d}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">Monthly Budgets by Category</h3>
              {groupSum(activeMonthlyBudgets, b => b.category).map(([c, v]) => <div key={c} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{c}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
          </div>
          {activeExtensions.length > 0 && <div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><h3 className="font-bold text-amber-900 text-sm">Extensions: {activeExtensions.length} totaling ₹{(activeExtensions.reduce((s, e) => s + e.amountINR, 0) / 100000).toFixed(2)}L</h3></div>}
        </div>
      )}

      {section === "expense" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <div className="text-sm text-emerald-700">Total Paid</div>
            <div className="text-3xl font-bold text-emerald-900">₹{(paidReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0) / 100000).toFixed(2)}L</div>
            <div className="text-xs text-emerald-600 mt-1">{paidReqs.length} payment{paidReqs.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">By Department</h3>
              {groupSum(paidReqs, r => r.dept).length === 0 ? <div className="text-sm text-slate-500">None</div> : groupSum(paidReqs, r => r.dept).map(([d, v]) => <div key={d} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{d}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">By Category</h3>
              {groupSum(paidReqs, r => r.expenseTypeName).length === 0 ? <div className="text-sm text-slate-500">None</div> : groupSum(paidReqs, r => r.expenseTypeName).map(([c, v]) => <div key={c} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{c}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-3">By Project</h3>
            {groupSum(paidReqs.filter(r => r.projectId), r => r.projectId).length === 0 ? <div className="text-sm text-slate-500">None</div> : groupSum(paidReqs.filter(r => r.projectId), r => r.projectId).map(([p, v]) => {
              const budget = activeProjBudgets.find(b => b.projectId === p);
              return <div key={p} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><div><span className="font-mono text-xs">{p}</span>{budget && <span className="ml-2">{budget.projectName}</span>}</div><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>;
            })}
          </div>
        </div>
      )}

      {section === "pnl" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-1">Client Project P&L</h3>
            <p className="text-xs text-slate-500 mb-3">P&L = Client Order − Total Paid Expenses</p>
            {clientProjects.length === 0 ? <div className="text-sm text-slate-500 py-4">No active client projects.</div> : (
              <div className="space-y-2">
                {clientProjects.map(b => {
                  const projPaid = paidReqs.filter(r => r.projectId === b.projectId).reduce((s, r) => s + (r.amountINR || r.amount), 0);
                  const projCommitted = requests.filter(r => r.projectId === b.projectId && !["Paid", "Rejected", "Cancelled"].includes(r.status)).reduce((s, r) => s + (r.amountINR || r.amount), 0);
                  const profit = b.clientOrderValue - projPaid;
                  const margin = b.clientOrderValue > 0 ? (profit / b.clientOrderValue) * 100 : 0;
                  return (
                    <div key={b.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                        <div>
                          <div className="font-bold">{b.projectName}</div>
                          <div className="text-xs font-mono text-slate-500">{b.projectId}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${margin >= 20 ? "bg-emerald-100 text-emerald-700" : margin >= 10 ? "bg-amber-100 text-amber-700" : margin >= 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>{margin >= 0 ? "+" : ""}{margin.toFixed(1)}% margin</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white rounded p-2"><div className="text-slate-500">Client Order</div><div className="font-bold">₹{(b.clientOrderValue / 100000).toFixed(2)}L</div></div>
                        <div className="bg-white rounded p-2"><div className="text-slate-500">Budget</div><div className="font-bold">₹{(b.amountINR / 100000).toFixed(2)}L</div></div>
                        <div className="bg-white rounded p-2"><div className="text-slate-500">Paid</div><div className="font-bold text-emerald-700">₹{(projPaid / 100000).toFixed(2)}L</div></div>
                        <div className={`rounded p-2 ${profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}><div className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>P&L</div><div className={`font-bold ${profit >= 0 ? "text-emerald-900" : "text-red-900"}`}>₹{(profit / 100000).toFixed(2)}L</div></div>
                      </div>
                      {projCommitted > 0 && <div className="text-xs text-amber-700 mt-2">⚠ +₹{(projCommitted / 100000).toFixed(2)}L committed</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {rdProjects.length > 0 && (
            <div className="bg-fuchsia-50 rounded-xl border border-fuchsia-200 p-4">
              <h3 className="font-bold text-fuchsia-900 mb-1">R&D Cost Center</h3>
              <p className="text-xs text-fuchsia-700 mb-3">No client revenue. Pure internal cost.</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded p-2"><div className="text-fuchsia-700 text-xs">Active Budgets</div><div className="font-bold text-fuchsia-900">₹{(rdProjects.reduce((s, p) => s + p.amountINR, 0) / 100000).toFixed(2)}L</div></div>
                <div className="bg-white rounded p-2"><div className="text-fuchsia-700 text-xs">Paid (Cost)</div><div className="font-bold text-fuchsia-900">₹{(rdPaid / 100000).toFixed(2)}L</div></div>
                <div className="bg-white rounded p-2"><div className="text-fuchsia-700 text-xs">Projects</div><div className="font-bold text-fuchsia-900">{rdProjects.length}</div></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
