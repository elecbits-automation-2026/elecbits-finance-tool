import { useState } from "react";
import { XCircle, CheckCircle } from "lucide-react";
import { signUp, changePassword, forgotPassword } from "../lib/auth";
import { ElecbitsLogo } from "../components/ElecbitsLogo";

const DEPARTMENTS = ["ODM", "Sales", "Box Build", "HR", "Product", "Marketing", "Finance", "Management", "Executive"];

type Mode = "signin" | "signup" | "reset" | "forgot";

// ============ LOGIN ============
export function LoginPage({ onLogin }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [designation, setDesignation] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setNewPassword("");
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
    if (!dept) { setError("Please select your department"); return; }
    const code = employeeCode.trim().toUpperCase();
    if (!code) { setError("Please enter your Employee Code"); return; }
    if (!/^EB-[A-Z0-9]{4}-[A-Z0-9]{3}$/.test(code)) { setError("Employee Code must be in the format EB-XXXX-XXX"); return; }
    if (!email || !password) { setError("Please enter both email and password"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setBusy(true);
    const r = await signUp({ email, password, name: name.trim(), dept, designation: designation.trim() || undefined, employeeCode: code });
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    setNotice("Account created — it's awaiting admin approval. You'll be able to sign in once an admin activates it.");
    setPassword("");
    setMode("signin");
  }

  // "Reset" — change the password when the user knows their current one. Verifies
  // the current password, sets the new one, and returns them to sign in with it.
  async function submitReset() {
    setError("");
    setNotice("");
    if (!email) { setError("Please enter your email"); return; }
    if (!password) { setError("Please enter your current password"); return; }
    if (newPassword.length < 6) { setError("New password must be at least 6 characters"); return; }
    setBusy(true);
    const r = await changePassword(email, password, newPassword);
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    setNotice("Password updated — sign in with your new password.");
    setPassword("");
    setNewPassword("");
    setMode("signin");
  }

  // "Forgot password" — email the user a secure reset link (Supabase built-in).
  // We always show the same generic confirmation so the form can't be used to
  // probe which emails have accounts.
  async function submitForgot() {
    setError("");
    setNotice("");
    if (!email) { setError("Please enter your email"); return; }
    setBusy(true);
    const r = await forgotPassword(email);
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    setNotice("If an account exists for that email, a password-reset link is on its way. Check your inbox (and spam), then follow the link to set a new password.");
  }

  function onEnter() {
    if (mode === "signin") submit();
    else if (mode === "signup") submitSignup();
    else if (mode === "reset") submitReset();
    else if (mode === "forgot") submitForgot();
  }

  const title =
    mode === "signin" ? "Welcome back" :
    mode === "signup" ? "Create your account" :
    mode === "reset" ? "Change your password" :
    "Reset your password";

  const subtitle =
    mode === "signin" ? "Sign in with your @elecbits.in email" :
    mode === "signup" ? "Sign up — your account will be reviewed by an admin before access is granted" :
    mode === "reset" ? "Enter your current password and choose a new one." :
    "Enter your email and we'll send you a secure link to set a new password.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <ElecbitsLogo size="lg" showTagline />
            <p className="text-xs text-slate-500 mt-2">Budget · PO · Payment Management</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
          <p className="text-sm text-slate-600 mb-6">{subtitle}</p>
          <div className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitSignup()} placeholder="Your name" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department <span className="font-normal text-red-500">*</span></label>
                  <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select a department…</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Employee Code <span className="font-normal text-red-500">*</span></label>
                  <input type="text" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && submitSignup()} placeholder="EB-XXXX-XXX" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Designation <span className="font-normal text-slate-400">(optional)</span></label>
                  <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitSignup()} placeholder="e.g. Project Manager" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter()} placeholder="your.name@elecbits.in" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {mode !== "forgot" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{mode === "reset" ? "Current Password" : "Password"}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter()} placeholder={mode === "signin" ? "Enter password" : mode === "reset" ? "Enter current password" : "At least 6 characters"} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {mode === "reset" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter()} placeholder="At least 6 characters" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
            {notice && <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0" />{notice}</div>}
            {mode === "signin" ? (
              <button onClick={submit} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg">Sign In</button>
            ) : mode === "signup" ? (
              <button onClick={submitSignup} disabled={busy} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60">{busy ? "Creating account…" : "Create Account"}</button>
            ) : mode === "reset" ? (
              <button onClick={submitReset} disabled={busy} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60">{busy ? "Updating…" : "Update Password"}</button>
            ) : (
              <button onClick={submitForgot} disabled={busy} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60">{busy ? "Sending…" : "Send Reset Link"}</button>
            )}
            <div className="text-center text-xs text-slate-600 space-y-1">
              {mode === "signin" ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => switchMode("reset")} className="text-blue-600 hover:text-blue-700 font-semibold">Reset password</button>
                    <span className="text-slate-300">·</span>
                    <button onClick={() => switchMode("forgot")} className="text-blue-600 hover:text-blue-700 font-semibold">Forgot password?</button>
                  </div>
                  <div>New here? <button onClick={() => switchMode("signup")} className="text-blue-600 hover:text-blue-700 font-semibold">Create an account</button></div>
                </>
              ) : mode === "signup" ? (
                <>Already have an account? <button onClick={() => switchMode("signin")} className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</button></>
              ) : (
                <>Remembered it? <button onClick={() => switchMode("signin")} className="text-blue-600 hover:text-blue-700 font-semibold">Back to sign in</button></>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
