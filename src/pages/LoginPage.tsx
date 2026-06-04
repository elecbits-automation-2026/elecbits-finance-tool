import { useState } from "react";
import { XCircle, CheckCircle, Key } from "lucide-react";
import { USERS } from "../constants";
import { signUp } from "../lib/auth";
import { ElecbitsLogo } from "../components/ElecbitsLogo";

const DEPARTMENTS = ["ODM", "Sales", "Box Build", "HR", "Product+Marketing", "Finance", "Management", "Executive"];

// ============ LOGIN ============
export function LoginPage({ onLogin }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHints, setShowHints] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit() {
    setError("");
    if (!email || !password) { setError("Please enter both email and password"); return; }
    const r = await onLogin(email, password);
    if (!r.success) setError(r.error);
  }

  async function submitSignup() {
    setError("");
    setNotice("");
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email || !password) { setError("Please enter both email and password"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setBusy(true);
    const r = await signUp({ email, password, name: name.trim(), dept: dept || undefined, designation: designation.trim() || undefined });
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    setNotice("Account created — it's awaiting admin approval. You'll be able to sign in once an admin activates it.");
    setPassword("");
    setMode("signin");
  }

  const groupedUsers = [
    { role: "CEO", emoji: "🎯", users: USERS.filter(u => u.role === "CEO") },
    { role: "VP", emoji: "⭐", users: USERS.filter(u => u.role === "VP") },
    { role: "Special Access Managers", emoji: "🔐", users: USERS.filter(u => u.role === "SuperManager") },
    { role: "Finance", emoji: "💰", users: USERS.filter(u => u.role === "FinanceHead" || u.role === "Accountant") },
    { role: "Department Heads", emoji: "👔", users: USERS.filter(u => u.role === "DeptApprover" || u.role === "BoxBuildMidApprover") },
    { role: "Employees", emoji: "👤", users: USERS.filter(u => u.role === "Employee") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <ElecbitsLogo size="lg" showTagline />
            <p className="text-xs text-slate-500 mt-2">Budget · PO · Payment Management</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="text-sm text-slate-600 mb-6">{mode === "signin" ? "Sign in with your @elecbits.in email" : "Sign up — your account will be reviewed by an admin before access is granted"}</p>
          <div className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitSignup()} placeholder="Your name" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department <span className="font-normal text-slate-400">(optional)</span></label>
                  <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select a department…</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Designation <span className="font-normal text-slate-400">(optional)</span></label>
                  <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitSignup()} placeholder="e.g. Project Manager" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? submit() : submitSignup())} placeholder="your.name@elecbits.in" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? submit() : submitSignup())} placeholder={mode === "signin" ? "Enter password" : "At least 6 characters"} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
            {notice && <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0" />{notice}</div>}
            {mode === "signin" ? (
              <button onClick={submit} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg">Sign In</button>
            ) : (
              <button onClick={submitSignup} disabled={busy} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60">{busy ? "Creating account…" : "Create Account"}</button>
            )}
            <div className="text-center text-xs text-slate-600">
              {mode === "signin" ? (
                <>New here? <button onClick={() => switchMode("signup")} className="text-blue-600 hover:text-blue-700 font-semibold">Create an account</button></>
              ) : (
                <>Already have an account? <button onClick={() => switchMode("signin")} className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</button></>
              )}
            </div>
            {mode === "signin" && <button onClick={() => setShowHints(!showHints)} className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium">{showHints ? "Hide" : "Show"} test credentials</button>}
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-white" />
            <h3 className="text-white font-bold text-sm">Quick Login (21 Users)</h3>
          </div>
          <p className="text-white/70 text-xs mb-4">Click any user to auto-login.</p>
          {!showHints ? (
            <div className="text-white/60 text-sm text-center py-8">Click "Show test credentials" to see all users</div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {groupedUsers.map((g) => g.users.length > 0 && (
                <div key={g.role}>
                  <div className="text-white/80 text-xs font-bold mt-2 mb-1">{g.emoji} {g.role}</div>
                  {g.users.map((u) => (
                    <button key={u.email} onClick={() => setTimeout(() => onLogin(u.email, u.password), 50)} className="w-full text-left bg-white/5 hover:bg-white/15 rounded-lg px-3 py-2 text-xs transition border border-white/10">
                      <div className="text-white font-semibold">{u.name}</div>
                      <div className="text-white/60">{u.designation} · {u.dept}</div>
                      <div className="text-blue-200 font-mono text-[10px] mt-0.5">{u.email}</div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
