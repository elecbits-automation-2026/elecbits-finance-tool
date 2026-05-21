import { useState, useEffect } from "react";
import {
  USERS, SEED_BUDGETS, SEED_POS,
  STORAGE_KEY_REQUESTS, STORAGE_KEY_BUDGETS, STORAGE_KEY_NOTIFS, STORAGE_KEY_POS, STORAGE_KEY_PO_COUNTER,
} from "./constants";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
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

  useEffect(() => {
    loadData().catch(err => {
      console.error("Fatal load error:", err);
      // Use seed data as fallback
      setBudgets(SEED_BUDGETS);
      setPOs(SEED_POS);
      setPOCounter(2);
      setLoading(false);
    });
  }, []);

  async function loadData() {
    // Requests
    try {
      const r = await window.storage.get(STORAGE_KEY_REQUESTS, true);
      if (r && r.value) setRequests(JSON.parse(r.value));
    } catch (err) {
      console.log("No requests in storage yet:", err?.message);
      setRequests([]);
    }

    // Budgets
    try {
      const b = await window.storage.get(STORAGE_KEY_BUDGETS, true);
      if (b && b.value) {
        setBudgets(JSON.parse(b.value));
      } else {
        setBudgets(SEED_BUDGETS);
        try { await window.storage.set(STORAGE_KEY_BUDGETS, JSON.stringify(SEED_BUDGETS), true); } catch (e) { console.log("Seed budget save failed:", e?.message); }
      }
    } catch (err) {
      console.log("Budget load failed, using seed:", err?.message);
      setBudgets(SEED_BUDGETS);
      try { await window.storage.set(STORAGE_KEY_BUDGETS, JSON.stringify(SEED_BUDGETS), true); } catch {}
    }

    // POs
    try {
      const p = await window.storage.get(STORAGE_KEY_POS, true);
      if (p && p.value) {
        setPOs(JSON.parse(p.value));
      } else {
        setPOs(SEED_POS);
        try { await window.storage.set(STORAGE_KEY_POS, JSON.stringify(SEED_POS), true); } catch (e) { console.log("Seed PO save failed:", e?.message); }
      }
    } catch (err) {
      console.log("PO load failed, using seed:", err?.message);
      setPOs(SEED_POS);
      try { await window.storage.set(STORAGE_KEY_POS, JSON.stringify(SEED_POS), true); } catch {}
    }

    // PO Counter
    try {
      const c = await window.storage.get(STORAGE_KEY_PO_COUNTER, true);
      if (c && c.value) {
        setPOCounter(parseInt(c.value));
      } else {
        setPOCounter(2);
        try { await window.storage.set(STORAGE_KEY_PO_COUNTER, "2", true); } catch {}
      }
    } catch (err) {
      console.log("PO counter load failed, using 2:", err?.message);
      setPOCounter(2);
    }

    // Notifications
    try {
      const n = await window.storage.get(STORAGE_KEY_NOTIFS, true);
      if (n && n.value) setNotifications(JSON.parse(n.value));
    } catch (err) {
      console.log("Notifications load failed:", err?.message);
      setNotifications([]);
    }

    // Always set loading false at the end
    setLoading(false);
  }

  async function saveRequests(v) { setRequests(v); try { await window.storage.set(STORAGE_KEY_REQUESTS, JSON.stringify(v), true); } catch {} }
  async function saveBudgets(v) { setBudgets(v); try { await window.storage.set(STORAGE_KEY_BUDGETS, JSON.stringify(v), true); } catch {} }
  async function savePOs(v) { setPOs(v); try { await window.storage.set(STORAGE_KEY_POS, JSON.stringify(v), true); } catch {} }
  async function savePOCounter(v) { setPOCounter(v); try { await window.storage.set(STORAGE_KEY_PO_COUNTER, String(v), true); } catch {} }
  async function saveNotifications(v) { setNotifications(v); try { await window.storage.set(STORAGE_KEY_NOTIFS, JSON.stringify(v), true); } catch {} }
  function showToast(message, type = "info") { setToast({ message, type, id: Date.now() }); setTimeout(() => setToast(null), 3000); }
  async function addNotifications(newOnes) { await saveNotifications([...newOnes, ...notifications]); }

  function handleLogin(email, password) {
    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
    if (user) { setCurrentUser(user); return { success: true }; }
    return { success: false, error: "Invalid email or password" };
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-slate-500">Loading…</div></div>;
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;
  return (
    <>
      <Dashboard user={currentUser} requests={requests} budgets={budgets} pos={pos} poCounter={poCounter} notifications={notifications} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} saveNotifications={saveNotifications} addNotifications={addNotifications} showToast={showToast} onLogout={() => setCurrentUser(null)} />
      {toast && <Toast toast={toast} />}
    </>
  );
}
