import { useState, useEffect } from "react";
import { db } from "./lib/db";
import { signIn, signOut, getCurrentUser, listEmployees } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { setRoster } from "./lib/roster";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { Dashboard } from "./pages/Dashboard";
import { AdminConsole } from "./pages/AdminConsole";
import { Toast } from "./components/Toast";

// True when the page was opened from a password-reset email link, which carries
// `type=recovery` in the URL hash (e.g. #access_token=…&type=recovery).
function isRecoveryUrl() {
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";
  } catch {
    return false;
  }
}

// ============ MAIN APP ============
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pos, setPOs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [poCounter, setPOCounter] = useState(2);
  const [piCounter, setPICounter] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  // A "forgot password" reset link lands on #...&type=recovery. Detect it
  // synchronously on first render — Supabase strips the hash asynchronously as it
  // establishes the recovery session, so reading it now (and not relying solely
  // on the async PASSWORD_RECOVERY event) reliably wins that race.
  const [recovery, setRecovery] = useState(isRecoveryUrl);

  // Restore an existing Supabase session on first load — but NOT when arriving
  // via a recovery link, or we'd route that temporary session into the app
  // instead of showing the set-new-password screen.
  useEffect(() => {
    if (recovery) { setLoading(false); return; }
    getCurrentUser()
      .then((u) => setCurrentUser(u))
      .catch((err) => console.error("Session restore failed:", err))
      .finally(() => setLoading(false));
  }, []);

  // Keep auth state in sync across tabs. Supabase mirrors the session to
  // localStorage and fires onAuthStateChange in every tab, so this one listener
  // makes logout, login and account-status changes propagate everywhere:
  //  - PASSWORD_RECOVERY: backup for a reset link whose hash was already consumed.
  //  - SIGNED_OUT: a logout (or a status-gate signOut) in any tab clears this one.
  //  - SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED: re-validate through the status
  //    gate, so a pending/disabled account (e.g. a fresh signup, which Supabase
  //    auto-signs-in) is never shown — in this tab or another.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setRecovery(true); setLoading(false); return; }
      if (event === "SIGNED_OUT") { setCurrentUser(null); setDataLoaded(false); return; }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (!session) { setCurrentUser(null); return; }
        getCurrentUser().then((u) => setCurrentUser(u)).catch((err) => console.error("Auth sync failed:", err));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load shared finance data once a user is signed in.
  // The admin account never touches the finance dashboard, so skip the load.
  useEffect(() => {
    if (currentUser && currentUser.role !== "Admin" && !dataLoaded) {
      loadData()
        .then(() => setDataLoaded(true))
        .catch((err) => console.error("Fatal load error:", err));
    }
  }, [currentUser, dataLoaded]);

  async function loadData() {
    // Live roster — drives approval routing so heads created at runtime (not just the
    // seeded users) are recognised as approvers. Falls back to the seeded roster on
    // failure. Only active accounts are eligible to approve.
    try {
      const employees = await listEmployees();
      setRoster(employees.filter((e) => e.status === "active"));
    } catch (err) {
      console.log("Roster load failed, using seeded roster:", err?.message);
    }

    // Requests
    try {
      setRequests(await db.fetchRequests());
    } catch (err) {
      console.log("Requests load failed:", err?.message);
      setRequests([]);
    }

    // Budgets
    try {
      setBudgets(await db.fetchBudgets());
    } catch (err) {
      console.log("Budget load failed:", err?.message);
      setBudgets([]);
    }

    // POs
    try {
      setPOs(await db.fetchPOs());
    } catch (err) {
      console.log("PO load failed:", err?.message);
      setPOs([]);
    }

    // Suppliers (master used by the PO form for the supplier dropdown)
    try {
      setSuppliers(await db.fetchSuppliers());
    } catch (err) {
      console.log("Suppliers load failed:", err?.message);
      setSuppliers([]);
    }

    // PO Counter
    try {
      const c = await db.fetchPOCounter();
      setPOCounter(c != null ? c : 0);
    } catch (err) {
      console.log("PO counter load failed, using 0:", err?.message);
      setPOCounter(0);
    }

    // PI Counter
    try {
      const c = await db.fetchPICounter();
      setPICounter(c != null ? c : 0);
    } catch (err) {
      console.log("PI counter load failed, using 0:", err?.message);
      setPICounter(0);
    }

    // Notifications
    try {
      setNotifications(await db.fetchNotifications());
    } catch (err) {
      console.log("Notifications load failed:", err?.message);
      setNotifications([]);
    }
  }

  async function saveRequests(v) { setRequests(v); try { await db.saveRequests(v); } catch (e) { console.error("saveRequests failed:", e?.message); } }
  // Budgets are server-enforced (migration 0011): write only the rows this
  // call actually changed, so the save carries exactly the caller's intent and
  // never re-asserts other users' rows against the workflow triggers.
  async function saveBudgets(v) {
    const prev = budgets;
    setBudgets(v);
    try {
      await db.saveBudgetsDiff(prev, v);
    } catch (e) {
      // The server rejected the write (workflow trigger): surface it and
      // re-sync local state so the UI doesn't show a change that never stuck.
      console.error("saveBudgets failed:", e?.message);
      showToast("Save rejected by server: " + (e?.message || "unknown error"), "error");
      try { setBudgets(await db.fetchBudgets()); } catch { /* keep optimistic state */ }
    }
  }
  // POs are dept-scoped (RLS, 0020), so write only the rows this call changed —
  // a full replace would prune POs the user can't see (other departments').
  async function savePOs(v) {
    const prev = pos;
    setPOs(v);
    try {
      await db.savePOsDiff(prev, v);
    } catch (e) {
      console.error("savePOs failed:", e?.message);
      showToast("Save failed: " + (e?.message || "unknown error"), "error");
      try { setPOs(await db.fetchPOs()); } catch { /* keep optimistic state */ }
    }
  }
  async function saveSuppliers(v) { setSuppliers(v); try { await db.saveSuppliers(v); } catch (e) { console.error("saveSuppliers failed:", e?.message); } }
  async function savePOCounter(v) { setPOCounter(v); try { await db.savePOCounter(v); } catch (e) { console.error("savePOCounter failed:", e?.message); } }
  async function savePICounter(v) { setPICounter(v); try { await db.savePICounter(v); } catch (e) { console.error("savePICounter failed:", e?.message); } }
  async function saveNotifications(v) { setNotifications(v); try { await db.saveNotifications(v); } catch (e) { console.error("saveNotifications failed:", e?.message); } }
  function showToast(message, type = "info") { setToast({ message, type, id: Date.now() }); setTimeout(() => setToast(null), 3000); }
  async function addNotifications(newOnes) { await saveNotifications([...newOnes, ...notifications]); }

  async function handleLogin(email, password) {
    const res = await signIn(email, password);
    if (res.success) { setCurrentUser(res.user); return { success: true }; }
    return { success: false, error: res.error };
  }

  async function handleLogout() {
    await signOut();
    setCurrentUser(null);
    setDataLoaded(false);
  }

  // Recovery takes priority over the loading screen and any session the URL also
  // established, so a user arriving from a reset link always lands on "set a new
  // password" first.
  if (recovery) return <ResetPasswordPage onDone={() => { window.location.hash = ""; setRecovery(false); setCurrentUser(null); setDataLoaded(false); }} />;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-slate-500">Loading…</div></div>;
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;
  if (currentUser.role === "Admin") return (
    <>
      <AdminConsole user={currentUser} onLogout={handleLogout} showToast={showToast} />
      {toast && <Toast toast={toast} />}
    </>
  );
  return (
    <>
      <Dashboard user={currentUser} requests={requests} budgets={budgets} pos={pos} suppliers={suppliers} poCounter={poCounter} piCounter={piCounter} notifications={notifications} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} saveSuppliers={saveSuppliers} savePOCounter={savePOCounter} savePICounter={savePICounter} saveNotifications={saveNotifications} addNotifications={addNotifications} showToast={showToast} onLogout={handleLogout} />
      {toast && <Toast toast={toast} />}
    </>
  );
}
