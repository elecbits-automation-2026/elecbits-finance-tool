import { useState } from "react";
import { Briefcase, Target } from "lucide-react";
import { getMonthlyBudgetUsage } from "../lib/finance";
import { isReadOnly } from "../lib/access";

// ============ BUDGET VIEW ============
export function BudgetView({ user, budgets, requests }) {
  const [tab, setTab] = useState("client");

  // Read-only viewers only see their own department's budgets. An extension
  // inherits the department of the project it extends.
  const scoped = isReadOnly(user)
    ? budgets.filter(b => b.type === "Extension"
        ? budgets.find(p => p.projectId === b.extensionFor && p.type === "Project")?.dept === user.dept
        : b.dept === user.dept)
    : budgets;

  const clientProjects = scoped.filter(b => b.type === "Project" && b.projectType === "Client" && (b.status === "Active" || b.currentStage === "Active"));
  const rdProjects = scoped.filter(b => b.type === "Project" && b.projectType === "RD" && (b.status === "Active" || b.currentStage === "Active"));
  const monthlyBudgets = scoped.filter(b => b.type === "Monthly" && (b.status === "Active" || b.currentStage === "Active"));
  const extensions = scoped.filter(b => b.type === "Extension" && (b.status === "Active" || b.currentStage === "Active"));

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("client")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "client" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600"}`}><Briefcase className="w-4 h-4 inline mr-1" />Client ({clientProjects.length})</button>
        <button onClick={() => setTab("rd")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "rd" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}><Target className="w-4 h-4 inline mr-1" />R&D ({rdProjects.length})</button>
        <button onClick={() => setTab("monthly")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "monthly" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600"}`}>Monthly ({monthlyBudgets.length})</button>
        <button onClick={() => setTab("extensions")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "extensions" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600"}`}>Extensions ({extensions.length})</button>
      </div>

      {tab === "client" && (
        <div className="space-y-3">
          {clientProjects.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active client projects.</div>}
          {clientProjects.map(b => {
            const projReqs = requests.filter(r => r.projectId === b.projectId);
            const committed = projReqs.filter(r => !["Rejected", "Cancelled", "Paid"].includes(r.status)).reduce((s, r) => s + (r.amountINR || r.amount), 0);
            const paid = projReqs.filter(r => r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
            const util = ((paid + committed) / b.amountINR) * 100;
            const margin = ((b.clientOrderValue - b.amountINR) / b.clientOrderValue) * 100;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">CLIENT</span><div className="font-bold">{b.projectName}</div></div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{b.projectId}</div>
                    <div className="text-xs text-slate-600 mt-1">{b.dept} · Client: {b.client}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">Active</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 mb-3 text-xs">
                  <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Client Order</div><div className="font-bold">₹{(b.clientOrderValue / 100000).toFixed(2)}L</div></div>
                  <div className="bg-blue-50 rounded p-2"><div className="text-blue-700">Budget</div><div className="font-bold text-blue-900">₹{(b.amountINR / 100000).toFixed(2)}L</div></div>
                  <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Margin</div><div className="font-bold text-emerald-900">{margin.toFixed(1)}%</div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Utilization</span><span>Paid: ₹{(paid / 100000).toFixed(1)}L · Committed: ₹{(committed / 100000).toFixed(1)}L</span></div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: (paid / b.amountINR * 100) + "%" }}></div>
                    <div className="h-full bg-amber-400" style={{ width: (committed / b.amountINR * 100) + "%" }}></div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{util.toFixed(0)}% used</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "rd" && (
        <div className="space-y-3">
          {rdProjects.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active R&D projects.</div>}
          {rdProjects.map(b => {
            const paid = requests.filter(r => r.projectId === b.projectId && r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
            const committed = requests.filter(r => r.projectId === b.projectId && !["Paid", "Rejected", "Cancelled"].includes(r.status)).reduce((s, r) => s + (r.amountINR || r.amount), 0);
            return (
              <div key={b.id} className="bg-white rounded-xl border border-fuchsia-200 p-4">
                <div className="flex items-center gap-2 mb-2"><span className="text-xs px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 font-bold">R&D</span><span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{b.rdType}</span><div className="font-bold">{b.projectName}</div></div>
                <div className="text-xs text-slate-500 font-mono">{b.projectId} · {b.dept}</div>
                {b.justification && <div className="text-xs text-slate-600 mt-1 italic">💡 {b.justification}</div>}
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-fuchsia-50 rounded p-2"><div className="text-fuchsia-700">Budget</div><div className="font-bold">₹{(b.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Paid</div><div className="font-bold">₹{(paid / 1000).toFixed(1)}K</div></div>
                  <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Committed</div><div className="font-bold">₹{(committed / 1000).toFixed(1)}K</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "monthly" && (
        <div className="space-y-3">
          {monthlyBudgets.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active monthly budgets.</div>}
          {monthlyBudgets.map(b => {
            const usage = getMonthlyBudgetUsage(requests, b.dept, b.category, b.month);
            const avail = Math.max(0, b.amountINR - usage.total);
            const util = (usage.total / b.amountINR) * 100;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <div className="font-bold">{b.dept} → {b.category}</div>
                    <div className="text-xs text-slate-500">Month: {b.month} · Approved by {b.approvedBy} · Pool open to all {b.dept} members</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">Active Pool</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(b.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Used</div><div className="font-bold">₹{(usage.total / 1000).toFixed(1)}K</div></div>
                  <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Available</div><div className="font-bold">₹{(avail / 1000).toFixed(1)}K</div></div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${util > 90 ? "bg-red-500" : util > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: Math.min(util, 100) + "%" }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "extensions" && (
        <div className="space-y-3">
          {extensions.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active extensions.</div>}
          {extensions.map(e => {
            const parent = budgets.find(b => b.projectId === e.extensionFor && b.type === "Project");
            return (
              <div key={e.id} className="bg-white rounded-xl border border-amber-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold">Extension: {parent?.projectName || e.extensionFor}</div>
                    <div className="text-xs text-slate-500 font-mono">{e.extensionFor}</div>
                    <div className="text-xs italic mt-1">{e.reason}</div>
                  </div>
                  <div className="text-lg font-bold">+₹{(e.amountINR / 100000).toFixed(2)}L</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
