import { useState } from "react";
import { Plane, BedDouble, AlertTriangle, Target, Users, Clock } from "lucide-react";
import { EXPENSE_TYPES, VP_THRESHOLD, CEO_THRESHOLD, TRAVEL_MIN_LEAD_DAYS } from "../constants";
import { isReadOnly } from "../lib/access";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, getStageLabel } from "../lib/workflow";
import { getRoster } from "../lib/roster";
import { getActiveMonthlyBudget, getMonthlyBudgetUsage } from "../lib/finance";
import { CurrencyInput } from "../components/CurrencyInput";
import { AttachmentInput } from "../components/AttachmentInput";
import { FlowPreview } from "../components/FlowPreview";

// ============ NEW TRAVEL / ACCOMMODATION REQUEST FORM ============
// A dedicated flow for travel & accommodation. It produces a normal `kind: "Payment"`
// record (so it rides the existing approval chain, monthly-pool matching and
// list/detail rendering) but carries a `travel` sub-object and is recognised
// downstream by `expenseTypeName ∈ {Travel, Accommodation}` / presence of `travel`.
// Extra rules vs a plain non-project payment:
//   - real date pickers for the trip / stay dates,
//   - an urgency justification when the trip starts within TRAVEL_MIN_LEAD_DAYS,
//   - an over-pool justification (travel is allowed to exceed its pool WITH a reason),
//   - an optional list of additional travellers (full name, age, sex).
export function NewTravelRequestForm({ user, requests, budgets, saveRequests, onSuccess }) {
  const [subType, setSubType] = useState("Travel"); // "Travel" | "Accommodation"
  const [form, setForm] = useState({
    fromLocation: "", toLocation: "", startDate: "", endDate: "",
    place: "", checkIn: "", checkOut: "",
    purpose: "", vendor: "",
    amount: "", currency: "INR", fxRate: 1,
    urgencyJustification: "", overshootJustification: "",
    attachment: null,
    selectedApproverIds: [],
  });
  const [travellers, setTravellers] = useState([]); // [{ fullName, age, sex }]
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isTravel = subType === "Travel";
  const expenseTypeId = isTravel ? "TR" : "AC";
  const selectedType = EXPENSE_TYPES.find(t => t.id === expenseTypeId);

  const amountINR = form.currency === "INR" ? parseFloat(form.amount || 0) : parseFloat(form.amount || 0) * parseFloat(form.fxRate || 0);

  // The date that determines urgency: trip start (Travel) or check-in (Accommodation).
  const startRef = isTravel ? form.startDate : form.checkIn;
  const endRef = isTravel ? form.endDate : form.checkOut;
  const todayISO = new Date().toISOString().slice(0, 10);
  const daysUntil = (d) => (d ? Math.round((new Date(d + "T00:00:00") - new Date(todayISO + "T00:00:00")) / 86400000) : null);
  const leadDays = daysUntil(startRef);
  const isUrgent = leadDays != null && leadDays < TRAVEL_MIN_LEAD_DAYS;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBudget = getActiveMonthlyBudget(budgets, user.dept, subType, currentMonth);
  const monthlyUsage = monthlyBudget ? getMonthlyBudgetUsage(requests, user.dept, subType, currentMonth) : null;
  const monthlyAvailable = monthlyBudget ? Math.max(0, monthlyBudget.amountINR - monthlyUsage.total) : 0;
  const isOvershoot = !!monthlyBudget && amountINR > monthlyAvailable;

  // Segregation of duties: never route a request to its own raiser (e.g. a dept head
  // raising their own travel), so drop the raiser from the eligible set.
  const eligibleApprovers = getEligibleDeptApprovers(user, selectedType, false).filter(a => a.id !== user.id);
  const needsMid = needsBoxBuildMidApproval(user);
  const isMultiApprover = eligibleApprovers.length > 1;

  function setTravellerRow(i, patch) { setTravellers(travellers.map((t, idx) => idx === i ? { ...t, ...patch } : t)); }
  const travellerStarted = (t) => t.fullName.trim() || String(t.age).trim() || t.sex;
  const travellerComplete = (t) => t.fullName.trim() && String(t.age).trim() && t.sex;

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } });
      setErr("");
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (isReadOnly(user)) return setErr("Your account is read-only and cannot raise requests.");
    if (!user.dept) return setErr("Your account has no department assigned. Ask an admin to set your department before raising requests.");
    if (!form.purpose.trim()) return setErr("Purpose mandatory");

    if (isTravel) {
      if (!form.fromLocation.trim() || !form.toLocation.trim()) return setErr("From and To locations are required");
      if (!form.startDate || !form.endDate) return setErr("Travel start and end dates are required");
      if (form.endDate < form.startDate) return setErr("End date cannot be before start date");
    } else {
      if (!form.place.trim()) return setErr("Accommodation location is required");
      if (!form.checkIn || !form.checkOut) return setErr("Check-in and check-out dates are required");
      if (form.checkOut < form.checkIn) return setErr("Check-out cannot be before check-in");
    }

    if (!form.amount || amountINR <= 0) return setErr("Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");

    // A pool must exist to draw from. Overshooting an existing pool is allowed for
    // travel WITH a justification (unlike other non-project expenses, which are blocked).
    if (!monthlyBudget) return setErr(`No active Monthly Budget for ${user.dept} → ${subType} for ${currentMonth}. Ask your Dept Head to raise one first.`);
    if (isOvershoot && !form.overshootJustification.trim()) return setErr(`This exceeds the ${subType} pool (available ₹${(monthlyAvailable / 1000).toFixed(1)}K). Add an over-budget justification to proceed.`);

    if (isUrgent && !form.urgencyJustification.trim()) return setErr(`This ${subType.toLowerCase()} starts in ${leadDays} day(s) — under the ${TRAVEL_MIN_LEAD_DAYS}-day notice. Add an urgency justification.`);

    if (travellers.some(t => travellerStarted(t) && !travellerComplete(t))) return setErr("Each additional traveller needs a full name, age and sex.");
    const travellerRows = travellers.filter(travellerComplete).map(t => ({ fullName: t.fullName.trim(), age: Number(t.age), sex: t.sex }));

    if (!form.attachment) return setErr("Attachment is mandatory");

    if (eligibleApprovers.length === 0) return setErr("No approver is available for your department (you cannot approve your own travel). Ask an admin to set up an approval chain.");
    let selectedApproverIds = [];
    if (isMultiApprover) {
      if (form.selectedApproverIds.length === 0) return setErr("Select an approver");
      selectedApproverIds = form.selectedApproverIds;
    } else selectedApproverIds = [eligibleApprovers[0].id];

    setSubmitting(true);
    const now = new Date().toISOString();
    const initialStage = needsMid ? "BoxBuildMid" : "DeptApproval";
    const description = isTravel
      ? `Travel: ${form.fromLocation.trim()} → ${form.toLocation.trim()}`
      : `Accommodation: ${form.place.trim()}`;

    const newRequest = {
      id: "EXP-" + Date.now(), kind: "Payment", createdDate: now,
      requesterId: user.id, requesterName: user.name, requesterEmail: user.email, dept: user.dept,
      expenseTypeId, expenseTypeName: subType, category: "Non-Project",
      isProject: false, projectId: null,
      vendor: form.vendor, description, purpose: form.purpose,
      amount: parseFloat(form.amount), currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR,
      attachment: form.attachment,
      travel: {
        subType,
        fromLocation: form.fromLocation, toLocation: form.toLocation, startDate: form.startDate, endDate: form.endDate,
        place: form.place, checkIn: form.checkIn, checkOut: form.checkOut,
        travellers: travellerRows,
        leadDays, urgent: isUrgent,
        urgencyJustification: isUrgent ? form.urgencyJustification.trim() : "",
        overshootJustification: isOvershoot ? form.overshootJustification.trim() : "",
      },
      selectedApprovers: selectedApproverIds,
      currentStage: initialStage, status: getStageLabel(initialStage),
      history: [{ action: "Submitted", by: user.name, byId: user.id, at: now, comments: `${subType} request raised` }],
    };
    await saveRequests([newRequest, ...requests]);
    setSubmitting(false);
    onSuccess();
  }

  const flowSteps = [user.name];
  if (needsMid) flowSteps.push("Delivery Head");
  if (isMultiApprover && form.selectedApproverIds.length > 0) flowSteps.push(form.selectedApproverIds.map(id => getRoster().find(u => u.id === id)?.name).filter(Boolean).join(" + "));
  else if (eligibleApprovers.length === 1) flowSteps.push(eligibleApprovers[0].name);
  else if (isMultiApprover) flowSteps.push("<select approver>");
  else flowSteps.push("Dept Head");
  flowSteps.push("Finance Head");
  if (amountINR >= VP_THRESHOLD && amountINR < CEO_THRESHOLD) flowSteps.push("VP");
  if (amountINR >= CEO_THRESHOLD) flowSteps.push("CEO");
  flowSteps.push("Accountant");

  const dateInput = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
  const textInput = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Plane className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">Raise Travel / Accommodation</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">Draws from your department's monthly <strong>{subType}</strong> pool. Book only after approval.</p>

      <div className="space-y-4">
        {/* Sub-type toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setSubType("Travel"); setErr(""); }} className={`px-3 py-3 rounded-lg text-sm font-semibold border flex items-center justify-center gap-1.5 ${isTravel ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-700 hover:border-blue-400"}`}>
            <Plane className="w-4 h-4" />Travel
          </button>
          <button type="button" onClick={() => { setSubType("Accommodation"); setErr(""); }} className={`px-3 py-3 rounded-lg text-sm font-semibold border flex items-center justify-center gap-1.5 ${!isTravel ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-700 hover:border-blue-400"}`}>
            <BedDouble className="w-4 h-4" />Accommodation
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Department</label><input value={user.dept} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600" /></div>
          <div><label className={labelCls}>Vendor / Payee</label><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Airline / hotel / agent" className={textInput} /></div>
        </div>

        {/* Trip / stay details */}
        {isTravel ? (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className={labelCls}>From *</label><input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} placeholder="Delhi" className={textInput} /></div>
              <div><label className={labelCls}>To *</label><input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} placeholder="Bangalore" className={textInput} /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Start date *</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={dateInput} /></div>
              <div><label className={labelCls}>End date *</label><input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={dateInput} /></div>
            </div>
          </>
        ) : (
          <>
            <div><label className={labelCls}>Location / Hotel *</label><input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Hotel name, city" className={textInput} /></div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Check-in *</label><input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className={dateInput} /></div>
              <div><label className={labelCls}>Check-out *</label><input type="date" value={form.checkOut} min={form.checkIn || undefined} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className={dateInput} /></div>
            </div>
          </>
        )}

        {/* Urgency notice + justification */}
        {isUrgent && (
          <div className="rounded-lg p-3 border bg-amber-50 border-amber-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1"><Clock className="w-4 h-4" />Short notice — starts in {leadDays} day(s)</div>
            <div className="text-xs text-amber-800 mb-2">This is under the {TRAVEL_MIN_LEAD_DAYS}-day notice window. Explain the urgency.</div>
            <textarea value={form.urgencyJustification} onChange={(e) => setForm({ ...form, urgencyJustification: e.target.value })} rows={2} placeholder="Why is this trip needed at short notice?" className={textInput} />
          </div>
        )}

        <div><label className={labelCls}>Purpose *</label><textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2} placeholder="Purpose of the trip / stay" className={textInput} /></div>

        <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Amount" required />

        {/* Monthly pool status */}
        {monthlyBudget ? (
          <div className={`rounded-lg p-3 border ${isOvershoot ? "bg-red-50 border-red-200" : monthlyUsage.total / monthlyBudget.amountINR > 0.8 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className="flex items-center gap-1.5 mb-1.5"><Target className="w-4 h-4 text-slate-700" /><div className="text-xs font-bold text-slate-900">📊 {user.dept} Monthly Pool — {subType}</div></div>
            <div className="text-xs text-slate-700 mb-1">Approved by <strong>{monthlyBudget.approvedBy || monthlyBudget.requesterName}</strong> · Available to all {user.dept} members</div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div className="bg-white rounded p-1.5"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(monthlyBudget.amountINR / 1000).toFixed(1)}K</div></div>
              <div className="bg-white rounded p-1.5"><div className="text-slate-500">Used</div><div className="font-bold">₹{(monthlyUsage.total / 1000).toFixed(1)}K</div></div>
              <div className="bg-white rounded p-1.5"><div className="text-slate-500">Available</div><div className="font-bold text-emerald-700">₹{(monthlyAvailable / 1000).toFixed(1)}K</div></div>
            </div>
            {isOvershoot && (
              <div className="mt-1">
                <div className="text-xs text-red-700 font-semibold mb-1">⚠ Exceeds the available pool by ₹{((amountINR - monthlyAvailable) / 1000).toFixed(1)}K. Allowed with a justification:</div>
                <textarea value={form.overshootJustification} onChange={(e) => setForm({ ...form, overshootJustification: e.target.value })} rows={2} placeholder="Why does this travel need to exceed the allocated budget?" className={textInput} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-xs">
            <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" /><div>
              <div className="font-bold text-amber-900">No Monthly {subType} pool</div>
              <div className="text-amber-800 mt-0.5">{user.dept} has no active <strong>{subType}</strong> budget for {currentMonth}. Ask your Dept Head to raise one.</div>
            </div></div>
          </div>
        )}

        {/* Additional travellers */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-slate-800"><Users className="w-4 h-4" />Additional travellers <span className="font-normal text-slate-500">(optional)</span></div>
          {travellers.length === 0 && <div className="text-xs text-slate-500 mb-2">Add anyone else travelling on this request.</div>}
          {travellers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap mb-1.5">
              <input value={t.fullName} onChange={(e) => setTravellerRow(i, { fullName: e.target.value })} placeholder="Full name" className="flex-1 min-w-[160px] px-2 py-1.5 border border-slate-300 rounded text-sm" />
              <input type="number" min="0" value={t.age} onChange={(e) => setTravellerRow(i, { age: e.target.value })} placeholder="Age" className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm" />
              <select value={t.sex} onChange={(e) => setTravellerRow(i, { sex: e.target.value })} className="w-28 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white">
                <option value="">Sex</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
              <button type="button" onClick={() => setTravellers(travellers.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600 px-1">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setTravellers([...travellers, { fullName: "", age: "", sex: "" }])} className="text-xs font-semibold text-blue-700 hover:text-blue-900">+ Add traveller</button>
        </div>

        {isMultiApprover && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <label className="block text-xs font-semibold text-indigo-900 mb-2">Select Approver *</label>
            <div className="space-y-1.5">
              {eligibleApprovers.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer bg-white rounded px-3 py-2 border border-indigo-200 hover:bg-indigo-50">
                  <input type="radio" checked={form.selectedApproverIds.includes(a.id)} onChange={() => setForm({ ...form, selectedApproverIds: [a.id] })} className="w-4 h-4" />
                  <div><div className="text-sm font-semibold text-slate-900">{a.name}</div><div className="text-xs text-slate-500">{a.designation}</div></div>
                </label>
              ))}
            </div>
          </div>
        )}

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required label="Supporting Document" />

        {amountINR > 0 && <FlowPreview steps={flowSteps} />}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : `Submit ${subType} Request`}</button>
        </div>
      </div>
    </div>
  );
}
