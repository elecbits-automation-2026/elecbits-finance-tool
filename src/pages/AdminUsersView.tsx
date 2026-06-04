import { useEffect, useState } from "react";
import { UserPlus, CheckCircle2, XCircle, RefreshCw, Mail, Clock } from "lucide-react";
import { listPendingSignups, approveSignup, rejectSignup } from "../lib/auth";

const DEPARTMENTS = ["ODM", "Sales", "Box Build", "HR", "Product+Marketing", "Finance", "Management", "Executive"];
const ROLES = [
  { value: "Employee", label: "Employee" },
  { value: "DeptApprover", label: "Department Head" },
  { value: "BoxBuildMidApprover", label: "Box Build Delivery Head" },
  { value: "Accountant", label: "Accountant" },
  { value: "FinanceHead", label: "Finance Head" },
  { value: "VP", label: "Vice President" },
  { value: "CEO", label: "CEO" },
  { value: "SuperManager", label: "Manager (Special Access)" },
];

// ============ ADMIN: PENDING SIGNUPS ============
export function AdminUsersView({ showToast }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({}); // keyed by authId: { role, dept, designation }
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await listPendingSignups();
      setPending(rows);
      const seed = {};
      rows.forEach((p) => { seed[p.authId] = { role: p.role || "Employee", dept: p.dept || "", designation: p.designation || "" }; });
      setEdits(seed);
    } catch (err) {
      if (showToast) showToast(`Could not load pending signups: ${err?.message || err}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function setEdit(authId, field, value) {
    setEdits((prev) => ({ ...prev, [authId]: { ...prev[authId], [field]: value } }));
  }

  async function approve(p) {
    const e = edits[p.authId] || {};
    setBusyId(p.authId);
    const r = await approveSignup(p.authId, p.email, { role: e.role, dept: e.dept || undefined, designation: e.designation?.trim() || undefined });
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Approve failed: ${r.error}`, "error"); return; }
    if (showToast) showToast(`${p.name} approved — they can now sign in.`, "success");
    load();
  }

  async function reject(p) {
    if (!window.confirm(`Reject ${p.name} (${p.email})? Their account will be disabled.`)) return;
    setBusyId(p.authId);
    const r = await rejectSignup(p.authId, p.email);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Reject failed: ${r.error}`, "error"); return; }
    if (showToast) showToast(`${p.name} rejected.`, "info");
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-fuchsia-600" />
          <h2 className="text-lg font-bold text-slate-900">Pending Signups</h2>
          {!loading && <span className="text-xs font-semibold bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-full">{pending.length}</span>}
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-5">Review self-service signups. Assign a role, department, and designation, then approve to let them sign in — or reject to disable the account.</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">No pending signups. 🎉</div>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const e = edits[p.authId] || {};
            const busy = busyId === p.authId;
            return (
              <div key={p.authId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>
                      {p.createdAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(p.createdAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Pending</span>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                    <select value={e.role} onChange={(ev) => setEdit(p.authId, "role", ev.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white">
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <select value={e.dept} onChange={(ev) => setEdit(p.authId, "dept", ev.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white">
                      <option value="">— none —</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                    <input value={e.designation} onChange={(ev) => setEdit(p.authId, "designation", ev.target.value)} placeholder="e.g. Project Manager" className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(p)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Approve & Activate</button>
                  <button onClick={() => reject(p)} disabled={busy} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
