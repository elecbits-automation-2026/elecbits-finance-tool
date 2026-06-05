import { useEffect, useMemo, useState } from "react";
import { LogOut, ShieldCheck, RefreshCw, Mail, Clock, Search, Users, CheckCircle2, Ban } from "lucide-react";
import { listEmployees, listRoles, setEmployeeRole, setEmployeeStatus } from "../lib/auth";
import { ElecbitsLogo } from "../components/ElecbitsLogo";

// ============ ADMIN CONSOLE ============
// Standalone landing page for the dedicated `admin` account. Lists every
// employee and lets the admin assign a role (from the `roles` catalog) and
// activate / deactivate the account. This replaces the finance dashboard for
// the admin (see routing in src/App.tsx).
export function AdminConsole({ user, onLogout, showToast }) {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [emps, rolesList] = await Promise.all([listEmployees(), listRoles()]);
      setEmployees(emps);
      setRoles(rolesList);
    } catch (err) {
      if (showToast) showToast(`Could not load employees: ${err?.message || err}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Map role key -> label for showing the current role nicely.
  const roleLabel = useMemo(() => {
    const m = {};
    roles.forEach((r) => { m[r.key] = r.label; });
    return m;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.name, e.email, e.dept, roleLabel[e.role] || e.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [employees, query, roleLabel]);

  async function changeRole(emp, role) {
    setBusyId(emp.authId);
    const r = await setEmployeeRole(emp.authId, role);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not update role: ${r.error}`, "error"); return; }
    setEmployees((prev) => prev.map((e) => (e.authId === emp.authId ? { ...e, role } : e)));
    if (showToast) showToast(`${emp.name} is now ${roleLabel[role] || role}.`, "success");
  }

  async function toggleStatus(emp) {
    const next = emp.status === "active" ? "disabled" : "active";
    if (next === "disabled" && !window.confirm(`Deactivate ${emp.name} (${emp.email})? They won't be able to sign in.`)) return;
    setBusyId(emp.authId);
    const r = await setEmployeeStatus(emp.authId, next);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not update status: ${r.error}`, "error"); return; }
    setEmployees((prev) => prev.map((e) => (e.authId === emp.authId ? { ...e, status: next } : e)));
    if (showToast) showToast(`${emp.name} ${next === "active" ? "activated" : "deactivated"}.`, next === "active" ? "success" : "info");
  }

  const statusStyles = {
    active: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    disabled: "bg-red-100 text-red-700",
  };

  const counts = useMemo(() => ({
    total: employees.length,
    active: employees.filter((e) => e.status === "active").length,
    pending: employees.filter((e) => e.status === "pending").length,
    disabled: employees.filter((e) => e.status === "disabled").length,
  }), [employees]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ElecbitsLogo size="md" />
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <ShieldCheck className="w-4 h-4 text-fuchsia-600" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Admin Console</p>
                <p className="text-xs text-slate-500">Employees · Roles · Access</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">Administrator</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm">AD</div>
            <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-fuchsia-600" />
            <h2 className="text-lg font-bold text-slate-900">Employees</h2>
            {!loading && (
              <span className="text-xs text-slate-500">
                {counts.total} total · <span className="text-emerald-600 font-semibold">{counts.active} active</span>
                {counts.pending > 0 && <> · <span className="text-amber-600 font-semibold">{counts.pending} pending</span></>}
                {counts.disabled > 0 && <> · <span className="text-red-600 font-semibold">{counts.disabled} disabled</span></>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, dept…" className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">Assign each employee a role-group and activate or deactivate their account. Role changes and status updates save immediately.</p>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">{query ? "No employees match your search." : "No employees yet."}</div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((emp) => {
              const busy = busyId === emp.authId;
              const active = emp.status === "active";
              return (
                <div key={emp.authId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid md:grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{emp.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusStyles[emp.status] || "bg-slate-100 text-slate-600"}`}>{emp.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>
                      {emp.dept && <span>· {emp.dept}</span>}
                      {emp.createdAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(emp.createdAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Role</label>
                      <select value={emp.role} disabled={busy} onChange={(e) => changeRole(emp, e.target.value)} className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50 min-w-[160px]">
                        {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                        {/* Surface any legacy role not in the catalog so it isn't silently lost. */}
                        {!roles.some((r) => r.key === emp.role) && <option value={emp.role}>{roleLabel[emp.role] || emp.role}</option>}
                      </select>
                    </div>
                    <button onClick={() => toggleStatus(emp)} disabled={busy} className={`mt-4 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${active ? "bg-red-50 hover:bg-red-100 border border-red-200 text-red-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                      {active ? <><Ban className="w-3.5 h-3.5" />Deactivate</> : <><CheckCircle2 className="w-3.5 h-3.5" />Activate</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
