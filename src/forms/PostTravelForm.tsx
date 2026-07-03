import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { AttachmentInput } from "../components/AttachmentInput";

// ============ POST-TRAVEL REPORT FORM ============
// Filed by the traveller AFTER their travel request is fully approved & paid, to
// justify the trip (replaces the old external Google Form). It writes a `postTravel`
// object + one history entry onto the SAME request row. The server allows this narrow
// write on a finalised row via the requests_guard branch added in migration 0025.
export function PostTravelForm({ request: r, user, requests_all, saveRequests, onDone }) {
  const [form, setForm] = useState({ actualDates: "", outcome: "", actualSpend: "", notes: "", attachment: null });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); setErr(""); };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (!form.outcome.trim()) return setErr("Outcome / purpose achieved is required");
    if (!form.attachment) return setErr("Bills / receipts are mandatory");
    if (form.actualSpend && Number(form.actualSpend) < 0) return setErr("Actual spend cannot be negative");

    setSubmitting(true);
    const now = new Date().toISOString();
    const postTravel = {
      actualDates: form.actualDates.trim(),
      outcome: form.outcome.trim(),
      actualSpend: form.actualSpend === "" ? null : Number(form.actualSpend),
      notes: form.notes.trim(),
      receipt: form.attachment,
      filedBy: user.name, filedById: user.id, filedAt: now,
    };
    const entry = { action: "Post-travel report filed", by: user.name, byId: user.id, at: now, comments: "" };
    // Only postTravel + history change — nothing else — as required by requests_guard.
    const updated = requests_all.map(x => x.id === r.id ? { ...x, postTravel, history: [...(x.history || []), entry] } : x);
    await saveRequests(updated);
    setSubmitting(false);
    onDone();
  }

  const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";
  const est = r.travel?.subType === "Accommodation" ? "stay" : "trip";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-5 h-5 text-teal-600" />
        <h2 className="text-xl font-bold text-slate-900">Post-travel report</h2>
      </div>
      <p className="text-sm text-slate-600 mb-1">{r.description} · <span className="font-mono text-xs">{r.id}</span></p>
      <p className="text-xs text-slate-500 mb-5">Justify the {est} now that it's complete. Approved amount: ₹{(r.amountINR || 0).toLocaleString("en-IN")}.</p>

      <div className="space-y-4">
        <div><label className={labelCls}>Actual dates travelled</label><input value={form.actualDates} onChange={(e) => setForm({ ...form, actualDates: e.target.value })} placeholder="e.g. 12–15 Jul 2026" className={inputCls} /></div>
        <div><label className={labelCls}>Outcome / purpose achieved *</label><textarea value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} rows={3} placeholder={`What was accomplished on this ${est}?`} className={inputCls} /></div>
        <div><label className={labelCls}>Actual amount spent (₹)</label><input type="number" min="0" value={form.actualSpend} onChange={(e) => setForm({ ...form, actualSpend: e.target.value })} placeholder="Actual INR spent" className={inputCls} /></div>
        <div><label className={labelCls}>Notes / learnings</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Anything worth noting for next time" className={inputCls} /></div>

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required label="Bills / receipts" />

        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : "Submit report"}</button>
        </div>
      </div>
    </div>
  );
}
