import { useState, useEffect } from "react";
import { SEED_BUDGETS, SEED_POS } from "./constants";
import { db } from "./lib/db";
import { signIn, signOut, getCurrentUser, listEmployees } from "./lib/auth";
import { setRoster } from "./lib/roster";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { AdminConsole } from "./pages/AdminConsole";
import { Toast } from "./components/Toast";

// ============ MAIN APP ============
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pos, setPOs] = useState([]);
  const [poCounter, setPOCounter] = useState(2);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Restore an existing Supabase session on first load.
  useEffect(() => {
    getCurrentUser()
      .then((u) => setCurrentUser(u))
      .catch((err) => console.error("Session restore failed:", err))
      .finally(() => setLoading(false));
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

    // Budgets (seed on first run if empty)
    try {
      const b = await db.fetchBudgets();
      if (b.length > 0) {
        setBudgets(b);
      } else {
        setBudgets(SEED_BUDGETS);
        try { await db.saveBudgets(SEED_BUDGETS); } catch (e) { console.log("Seed budget save failed:", e?.message); }
      }
    } catch (err) {
      console.log("Budget load failed, using seed:", err?.message);
      setBudgets(SEED_BUDGETS);
    }

    // POs (seed on first run if empty)
    try {
      const p = await db.fetchPOs();
      if (p.length > 0) {
        setPOs(p);
      } else {
        setPOs(SEED_POS);
        try { await db.savePOs(SEED_POS); } catch (e) { console.log("Seed PO save failed:", e?.message); }
      }
    } catch (err) {
      console.log("PO load failed, using seed:", err?.message);
      setPOs(SEED_POS);
    }

    // PO Counter
    try {
      const c = await db.fetchPOCounter();
      if (c != null) {
        setPOCounter(c);
      } else {
        setPOCounter(2);
        try { await db.savePOCounter(2); } catch {}
      }
    } catch (err) {
      console.log("PO counter load failed, using 2:", err?.message);
      setPOCounter(2);
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
  async function saveBudgets(v) { setBudgets(v); try { await db.saveBudgets(v); } catch (e) { console.error("saveBudgets failed:", e?.message); } }
  async function savePOs(v) { setPOs(v); try { await db.savePOs(v); } catch (e) { console.error("savePOs failed:", e?.message); } }
  async function savePOCounter(v) { setPOCounter(v); try { await db.savePOCounter(v); } catch (e) { console.error("savePOCounter failed:", e?.message); } }
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
      <Dashboard user={currentUser} requests={requests} budgets={budgets} pos={pos} poCounter={poCounter} notifications={notifications} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} saveNotifications={saveNotifications} addNotifications={addNotifications} showToast={showToast} onLogout={handleLogout} />
      {toast && <Toast toast={toast} />}
    </>
  );
}
