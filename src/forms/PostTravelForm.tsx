import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { AttachmentInput } from "../components/AttachmentInput";
import { uploadAttachment } from "../lib/storage";

// ============ TRAVEL OUTCOME (POST-TRAVEL) FORM ============
// Filed by the traveller AFTER their travel request is approved & paid, to record the
// outcomes of the trip. Writes a `postTravel` object + one history entry onto the SAME
// request row (allowed on a finalised row by the requests_guard branch in migration
// 0025). Mirrors the "Travel Outcome Form".
export function PostTravelForm({ request: r, user, requests_all, saveRequests, onDone }) {
  const t = r.travel || {};
  const [form, setForm] = useState({
    employeeName: user.name || "",
    employeeEmail: user.email || "",
    destinationCity: t.arrivalCity || t.toLocation || "",
    flightPNR: t.pnr || "",
    purpose: r.purpose || "",
    meetingsCompleted: "",
    keyOutcomes: "",
    expectedOrderDate: "",
    followUpActions: "",
    objectiveAchieved: "",
    remarks: "",
    attachment: null, // Boarding Pass
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large. Max 2MB."); return; }
    try {
      const att = await uploadAttachment(file);
      setForm(f => ({ ...f, attachment: att }));
      setErr("");
    } catch (err) {
      setErr("Upload failed: " + (err?.message || "please try again"));
    }
  }

  async function submit() {
    setErr("");
    if (!form.employeeName.trim()) return setErr("Employee name is required");
    if (!form.employeeEmail.trim()) return setErr("Employee email is required");
    if (!form.attachment) return setErr("Boarding pass is required");
    if (!form.keyOutcomes.trim()) return setErr("Key outcomes achieved is required");
    if (!form.objectiveAchieved) return setErr("Please select whether the trip objective was achieved");
    if (form.meetingsCompleted && Number(form.meetingsCompleted) < 0) return setErr("Meetings completed cannot be negative");

    setSubmitting(true);
    const now = new Date().toISOString();
    const postTravel = {
      employeeName: form.employeeName.trim(),
      employeeEmail: form.employeeEmail.trim(),
      destinationCity: form.destinationCity.trim(),
      boardingPass: form.attachment,
      flightPNR: form.flightPNR.trim(),
      purpose: form.purpose.trim(),
      meetingsCompleted: form.meetingsCompleted === "" ? null : Number(form.meetingsCompleted),
      keyOutcomes: form.keyOutcomes.trim(),
      expectedOrderDate: form.expectedOrderDate,
      followUpActions: form.followUpActions.trim(),
      objectiveAchieved: form.objectiveAchieved,
      remarks: form.remarks.trim(),
      filedBy: user.name, filedById: user.id, filedAt: now,
    };
    const entry = { action: "Travel outcome filed", by: user.name, byId: user.id, at: now, comments: `Objective ${form.objectiveAchieved}` };
    // Only postTravel + history change — nothing else — as required by requests_guard.
    const updated = requests_all.map(x => x.id === r.id ? { ...x, postTravel, history: [...(x.history || []), entry] } : x);
    await saveRequests(updated);
    setSubmitting(false);
    onDone();
  }

  const input = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
  const label = "block text-xs font-semibold text-slate-700 mb-1.5";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-5 h-5 text-teal-600" />
        <h2 className="text-xl font-bold text-slate-900">Travel Outcome Form</h2>
      </div>
      <p className="text-sm text-slate-600 mb-1">Use this form to record and share the outcomes of your travel. Please fill in all relevant details to help us track and improve future travel experiences.</p>
      <p className="text-xs text-slate-500 mb-5">{r.description} · <span className="font-mono">{r.id}</span></p>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className={label}>Employee Name *</label><input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} className={input} /></div>
          <div><label className={label}>Employee Email *</label><input type="email" value={form.employeeEmail} onChange={(e) => setForm({ ...form, employeeEmail: e.target.value })} className={input} /></div>
        </div>
        <div><label className={label}>Destination City</label><input value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.target.value })} className={input} /></div>

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required label="Boarding Pass" />

        <div><label className={label}>Flight PNR number <span className="font-normal text-slate-400">(base location → destination)</span></label><input value={form.flightPNR} onChange={(e) => setForm({ ...form, flightPNR: e.target.value })} className={input} /></div>
        <div><label className={label}>Purpose of Travel</label><input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={input} /></div>
        <div><label className={label}>Number of Meetings Completed</label><input type="number" min="0" value={form.meetingsCompleted} onChange={(e) => setForm({ ...form, meetingsCompleted: e.target.value })} className={input} /></div>
        <div><label className={label}>Key outcomes achieved *</label><textarea value={form.keyOutcomes} onChange={(e) => setForm({ ...form, keyOutcomes: e.target.value })} rows={3} className={input} /></div>
        <div><label className={label}>Expected date of order</label><input type="date" value={form.expectedOrderDate} onChange={(e) => setForm({ ...form, expectedOrderDate: e.target.value })} className={input} /></div>
        <div><label className={label}>Follow-up actions required</label><textarea value={form.followUpActions} onChange={(e) => setForm({ ...form, followUpActions: e.target.value })} rows={2} className={input} /></div>

        <div>
          <label className={label}>Whether trip objective was achieved? *</label>
          <div className="flex gap-4">
            {["Yes", "No", "Partially"].map(o => (
              <label key={o} className="flex items-center gap-1.5 text-sm text-slate-700"><input type="radio" name="objectiveAchieved" checked={form.objectiveAchieved === o} onChange={() => setForm({ ...form, objectiveAchieved: o })} className="w-4 h-4" />{o}</label>
            ))}
          </div>
        </div>

        <div><label className={label}>Additional remarks by employee</label><textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} className={input} /></div>

        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : "Submit outcome"}</button>
        </div>
      </div>
    </div>
  );
}
