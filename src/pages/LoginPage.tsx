import { useState } from "react";
import { XCircle, Key } from "lucide-react";
import { USERS } from "../constants";
import { ElecbitsLogo } from "../components/ElecbitsLogo";

// ============ LOGIN ============
export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showHints, setShowHints] = useState(false);

  function submit() {
    setError("");
    if (!email || !password) { setError("Please enter both email and password"); return; }
    const r = onLogin(email, password);
    if (!r.success) setError(r.error);
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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-sm text-slate-600 mb-6">Sign in with your @elecbits.in email</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="your.name@elecbits.in" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Enter password" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" />{error}</div>}
            <button onClick={submit} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg">Sign In</button>
            <button onClick={() => setShowHints(!showHints)} className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium">{showHints ? "Hide" : "Show"} test credentials</button>
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
