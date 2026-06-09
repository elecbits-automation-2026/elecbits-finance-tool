import { useState } from "react";
import { Coins, Target, Pencil, Inbox, X } from "lucide-react";
import { DEPARTMENTS, RD_MONTHLY_CAP } from "../constants";
import { getRDAllocation, getRDUsageForDeptMonth, getRDAllocationRequests } from "../lib/finance";

// ============ R&D MONTHLY ALLOCATION (SuperManager only) ============
// Lets a special user set the R&D monthly budget cap per department + month.
// These allocations drive the cap enforced when an R&D budget is raised.
export function RDAllocationView({ user, budgets, saveBudgets, showToast }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [form, setForm] = useState({ dept: "", month: currentMonth, amount: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const existing = form.dept && form.month ? getRDAllocation(budgets, form.dept, form.month) : null;
  const allocations = budgets
    .filter(b => b.type === "RDCap" && (b.status === "Active" || b.currentStage === "Active"))
    .sort((a, b) => (b.month || "").localeCompare(a.month || "") || (a.dept || "").localeCompare(b.dept || ""));
  const pendingRequests = getRDAllocationRequests(budgets);

  async function save() {
    setErr("");
    if (!form.dept) return setErr("Select a department");
    if (!form.month) return setErr("Select a month");
    const amt = parseFloat(form.amount || 0);
    if (!amt || amt <= 0) return setErr("Enter a valid budget amount");

    setSaving(true);
    const now = new Date().toISOString();
    const id = `RDCAP-${form.dept}-${form.month}`;
    const reqId = `RDCAPREQ-${form.dept}-${form.month}`;
    const prior = getRDAllocation(budgets, form.dept, form.month);
    const record = {
      id, kind: "RDCap", type: "RDCap", dept: form.dept, month: form.month,
      amount: amt, amountINR: amt, currency: "INR", fxRate: 1,
      status: "Active", currentStage: "Active",
      allocatedBy: user.name, allocatedById: user.id, createdDate: prior?.createdDate || now, updatedDate: now,
      history: [
        ...(prior?.history || []),
        { action: prior ? "Updated" : "Allocated", by: user.name, byId: user.id, at: now, comments: `R&D cap ₹${amt.toLocaleString("en-IN")} for ${form.dept} (${form.month})` },
      ],
    };
    // Deterministic id => replace any existing allocation; also clear a matching
    // pending request now that this dept+month has been funded.
    await saveBudgets([record, ...budgets.filter(b => b.id !== id && b.id !== reqId)]);
    setSaving(false);
    setForm({ ...form, amount: "" });
    showToast?.(`R&D budget allocated for ${form.dept} (${form.month})`, "success");
  }

  async function dismissRequest(r) {
    await saveBudgets(budgets.filter(b => b.id !== r.id));
    showToast?.(`Dismissed request from ${r.dept}`, "success");
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-5 h-5 text-fuchsia-600" />
            <h2 className="text-xl font-bold text-slate-900">Allocate Monthly R&D Budget</h2>
          </div>
          <p className="text-sm text-slate-600 mb-5">Set the Internal / R&D monthly cap for a department. This becomes the available budget when that department raises R&D budgets for the month.</p>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department *</label>
              <select value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Month *</label>
              <input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Allocated Budget (₹) *</label>
              <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={String(RD_MONTHLY_CAP)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          {existing && (
            <div className="mb-4 bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 text-xs text-fuchsia-900 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Existing allocation for <strong>{form.dept}</strong> ({form.month}): <strong>₹{existing.amountINR.toLocaleString("en-IN")}</strong>. Saving will update it.
            </div>
          )}
          {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">{err}</div>}

          <button onClick={save} disabled={saving} className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">
            {saving ? "Saving…" : existing ? "Update Allocation" : "Allocate Budget"}
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Current Allocations ({allocations.length})</h3>
          </div>
          <div className="space-y-3">
            {allocations.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No R&D allocations yet.</div>}
            {allocations.map(a => {
              const used = getRDUsageForDeptMonth(budgets, a.dept, a.month);
              const avail = Math.max(0, a.amountINR - used);
              const util = a.amountINR > 0 ? (used / a.amountINR) * 100 : 0;
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div>
                      <div className="font-bold">{a.dept}</div>
                      <div className="text-xs text-slate-500">Month: {a.month} · Allocated by {a.allocatedBy}</div>
                    </div>
                    <button onClick={() => setForm({ dept: a.dept, month: a.month, amount: String(a.amountINR) })} className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1"><Pencil className="w-3 h-3" />Edit</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div className="bg-fuchsia-50 rounded p-2"><div className="text-fuchsia-700">Allocated</div><div className="font-bold">₹{(a.amountINR / 1000).toFixed(1)}K</div></div>
                    <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Used</div><div className="font-bold">₹{(used / 1000).toFixed(1)}K</div></div>
                    <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Available</div><div className="font-bold">₹{(avail / 1000).toFixed(1)}K</div></div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${util > 90 ? "bg-red-500" : util > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: Math.min(util, 100) + "%" }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending allocation requests from departments */}
      <div className="lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900">Allocation Requests</h3>
          {pendingRequests.length > 0 && <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5">{pendingRequests.length}</span>}
        </div>
        <div className="space-y-2">
          {pendingRequests.length === 0 && <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No pending requests.</div>}
          {pendingRequests.map(r => (
            <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-amber-900">{r.dept}</div>
                  <div className="text-xs text-amber-800">Month: {r.month}</div>
                  <div className="text-xs text-slate-600 mt-0.5">by {r.requesterName}</div>
                </div>
                <button onClick={() => dismissRequest(r)} title="Dismiss" className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={() => setForm({ dept: r.dept, month: r.month, amount: "" })} className="mt-2 w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Allocate now</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
