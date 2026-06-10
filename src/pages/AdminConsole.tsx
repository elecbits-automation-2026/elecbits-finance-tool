import { useEffect, useMemo, useState } from "react";
import { LogOut, ShieldCheck, RefreshCw, Mail, Clock, Search, Users, CheckCircle2, Ban, KeyRound, Copy, Check, RotateCcw, Hourglass, X, Trash2, AlertTriangle } from "lucide-react";
import { listEmployees, listRoles, setEmployeeRole, setEmployeeDept, setEmployeeStatus, openReactivation, deactivateEmployee, deleteEmployee, getAccessPasswords } from "../lib/auth";
import { DEPARTMENTS } from "../constants";
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
  // authId -> access password the admin can use to sign in as that user.
  const [accessMap, setAccessMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    // Access passwords are optional (they need the admin_access table). A
    // failure here must never blank the employee list, so load them separately
    // and swallow errors.
    try {
      setAccessMap(await getAccessPasswords());
    } catch {
      setAccessMap({});
    }
  }

  async function copyPassword(emp, pw) {
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedId(emp.authId);
      setTimeout(() => setCopiedId((id) => (id === emp.authId ? null : id)), 1500);
    } catch {
      if (showToast) showToast("Could not copy to clipboard.", "error");
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

  // Assign / change an employee's department. Department drives request routing
  // and a department head's approval scope, so this also clears the "no department"
  // flag once set.
  async function changeDept(emp, dept) {
    setBusyId(emp.authId);
    const r = await setEmployeeDept(emp.authId, dept);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not update department: ${r.error}`, "error"); return; }
    setEmployees((prev) => prev.map((e) => (e.authId === emp.authId ? { ...e, dept } : e)));
    if (showToast) showToast(`${emp.name} is now in ${dept}.`, "success");
  }

  // Locally patch one employee's status after a successful action.
  function patchStatus(emp, status, extra = {}) {
    setEmployees((prev) => prev.map((e) => (e.authId === emp.authId ? { ...e, status, ...extra } : e)));
  }

  // Deactivate an active account: generate a password, reset the user's login,
  // and store it so the admin can sign in as them to review their activity.
  async function deactivate(emp) {
    if (!window.confirm(`Deactivate ${emp.name} (${emp.email})?\n\nThis resets their password and signs them out. A new password will be generated and shown here so you can sign in as them to review their activity.`)) return;
    setBusyId(emp.authId);
    const r = await deactivateEmployee(emp.authId);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not deactivate: ${r.error}`, "error"); return; }
    patchStatus(emp, "deactivated");
    setAccessMap((prev) => ({ ...prev, [emp.authId]: r.password }));
    if (showToast) showToast(`${emp.name} deactivated. Access password is shown on their card.`, "info");
  }

  // Open a deactivated/disabled account for reactivation. The user must then set
  // a new password from the login page before the admin approves (below).
  async function reopen(emp) {
    if (!window.confirm(`Re-activate ${emp.name}?\n\nThey'll be asked to set a NEW password from the login page ("Reactivate account"). It then comes back to you here to approve before they can sign in.`)) return;
    setBusyId(emp.authId);
    const r = await openReactivation(emp.authId);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not start re-activation: ${r.error}`, "error"); return; }
    patchStatus(emp, "reactivating");
    setAccessMap((prev) => { const n = { ...prev }; delete n[emp.authId]; return n; });
    if (showToast) showToast(`${emp.name} can now set a new password from the login page. Approve it here after.`, "info");
  }

  // Cancel an in-progress reactivation, sending the account back to deactivated.
  async function cancelReactivation(emp) {
    setBusyId(emp.authId);
    const r = await setEmployeeStatus(emp.authId, "deactivated");
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not cancel: ${r.error}`, "error"); return; }
    patchStatus(emp, "deactivated");
    if (showToast) showToast(`Re-activation cancelled for ${emp.name}.`, "info");
  }

  // Approve a pending account (new signup OR a reactivation) → active.
  async function approve(emp) {
    setBusyId(emp.authId);
    const r = await setEmployeeStatus(emp.authId, "active");
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not approve: ${r.error}`, "error"); return; }
    patchStatus(emp, "active");
    if (showToast) showToast(`${emp.name} approved — they can sign in now.`, "success");
  }

  // PERMANENTLY delete an account and erase ALL of the user's data. Irreversible,
  // so it's gated behind an explicit warning plus a typed "DELETE" confirmation.
  async function remove(emp) {
    if (!window.confirm(
      `⚠️ PERMANENTLY DELETE ${emp.name} (${emp.email})?\n\n` +
      `This erases EVERYTHING for this user — their account, profile, and all of ` +
      `their requests, purchase orders and notifications. This CANNOT be undone ` +
      `and there is no reactivation afterward.`
    )) return;
    const typed = window.prompt(`To confirm permanent deletion of ${emp.name}, type DELETE below:`);
    if (typed == null) return;
    if (typed.trim().toUpperCase() !== "DELETE") {
      if (showToast) showToast("Deletion cancelled — confirmation text did not match.", "info");
      return;
    }
    setBusyId(emp.authId);
    const r = await deleteEmployee(emp.authId);
    setBusyId(null);
    if (!r.success) { if (showToast) showToast(`Could not delete: ${r.error}`, "error"); return; }
    setEmployees((prev) => prev.filter((e) => e.authId !== emp.authId));
    setAccessMap((prev) => { const n = { ...prev }; delete n[emp.authId]; return n; });
    if (showToast) showToast(`${emp.name} and all their data were permanently deleted.`, "success");
  }

  const statusStyles = {
    active: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    disabled: "bg-red-100 text-red-700",
    deactivated: "bg-orange-100 text-orange-700",
    reactivating: "bg-sky-100 text-sky-700",
  };

  const counts = useMemo(() => ({
    total: employees.length,
    active: employees.filter((e) => e.status === "active").length,
    pending: employees.filter((e) => e.status === "pending").length,
    disabled: employees.filter((e) => e.status === "disabled" || e.status === "deactivated").length,
    noDept: employees.filter((e) => !e.dept).length,
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
                {counts.noDept > 0 && <> · <span className="text-red-600 font-semibold">{counts.noDept} no department</span></>}
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
              return (
                <div key={emp.authId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid md:grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{emp.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusStyles[emp.status] || "bg-slate-100 text-slate-600"}`}>{emp.status}</span>
                      {!emp.dept && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />No department</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>
                      {emp.dept && <span>· {emp.dept}</span>}
                      {emp.createdAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(emp.createdAt).toLocaleDateString()}</span>}
                    </div>
                    {emp.status === "deactivated" && accessMap[emp.authId] && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">Access password</span>
                        <code className="text-xs font-mono font-semibold text-slate-900 bg-white border border-orange-200 rounded px-1.5 py-0.5 select-all">{accessMap[emp.authId]}</code>
                        <button onClick={() => copyPassword(emp, accessMap[emp.authId])} className="text-orange-600 hover:text-orange-800" title="Copy password">
                          {copiedId === emp.authId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-[10px] text-orange-600/80 w-full">Sign in with <span className="font-semibold">{emp.email}</span> and this password to view their activity.</span>
                      </div>
                    )}
                    {emp.status === "reactivating" && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5">
                        <Hourglass className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                        <span className="text-[10px] text-sky-700">Waiting for <span className="font-semibold">{emp.name}</span> to set a new password from the login page. It'll return here as <span className="font-semibold">pending</span> for you to approve.</span>
                      </div>
                    )}
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
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Department</label>
                      <select value={emp.dept || ""} disabled={busy} onChange={(e) => changeDept(emp, e.target.value)} className={`text-xs px-2 py-1.5 border rounded-lg bg-white disabled:opacity-50 min-w-[140px] ${emp.dept ? "border-slate-300" : "border-red-300 ring-1 ring-red-200"}`}>
                        <option value="" disabled>Select…</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        {/* Surface any legacy department not in the catalog so it isn't silently lost. */}
                        {emp.dept && !DEPARTMENTS.includes(emp.dept) && <option value={emp.dept}>{emp.dept}</option>}
                      </select>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      {emp.status === "active" && (
                        <button onClick={() => deactivate(emp)} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700">
                          <Ban className="w-3.5 h-3.5" />Deactivate
                        </button>
                      )}
                      {(emp.status === "deactivated" || emp.status === "disabled") && (
                        <button onClick={() => reopen(emp)} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 bg-sky-600 hover:bg-sky-700 text-white">
                          <RotateCcw className="w-3.5 h-3.5" />Re-activate
                        </button>
                      )}
                      {emp.status === "reactivating" && (
                        <button onClick={() => cancelReactivation(emp)} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600">
                          <X className="w-3.5 h-3.5" />Cancel
                        </button>
                      )}
                      {emp.status === "pending" && (
                        <button onClick={() => approve(emp)} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle2 className="w-3.5 h-3.5" />Approve
                        </button>
                      )}
                      {/* Permanent delete — destructive, separated and available in every status. */}
                      <button onClick={() => remove(emp)} disabled={busy} title="Permanently delete this user and all their data" className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 ml-1 sm:ml-2 sm:border-l sm:border-slate-200 sm:pl-3 text-red-700 hover:bg-red-100">
                        <Trash2 className="w-3.5 h-3.5" />Delete
                      </button>
                    </div>
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
