import { Plane } from "lucide-react";
import { TRAVEL_MIN_LEAD_DAYS } from "../constants";

// Reason-for-travelling checkbox options (plus a free-text "Other").
const TRAVEL_REASONS = ["Client Visit", "Vendor Visit", "Event / Conference", "Internal Office Visit", "Emergency Travel"];

// The full Travel field set, rendered inline in Raise Payment when expense type =
// Travel. State (`tf`) is owned by the payment form so its submit() can validate and
// persist it into the request's `travel` sub-object.
export function TravelFields({ tf, setTf, leadDays, isShortNotice }) {
  const set = (patch) => setTf({ ...tf, ...patch });
  const today = new Date().toISOString().slice(0, 10);
  const toggleReason = (r) => set({ reasons: tf.reasons.includes(r) ? tf.reasons.filter(x => x !== r) : [...tf.reasons, r] });
  // A count input that spawns N sub-rows: resize the backing array (0–20), keeping
  // any values already entered.
  const resizeList = (key, countKey, nStr, blank) => {
    const n = Math.max(0, Math.min(20, parseInt(nStr, 10) || 0));
    const cur = tf[key] || [];
    setTf({ ...tf, [countKey]: nStr, [key]: Array.from({ length: n }, (_, i) => cur[i] || blank()) });
  };
  const setRow = (key, i, patch) => setTf({ ...tf, [key]: tf[key].map((x, idx) => idx === i ? { ...x, ...patch } : x) });
  const input = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
  const label = "block text-xs font-semibold text-slate-700 mb-1.5";
  const section = "text-xs font-bold text-slate-700 mb-2";
  const isRound = tf.tripType === "Round Trip";

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900"><Plane className="w-4 h-4" />Travel details</div>

      <div>
        <div className={section}>Personal details</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className={label}>Full Name *</label><input value={tf.fullName} onChange={(e) => set({ fullName: e.target.value })} className={input} /></div>
          <div><label className={label}>Contact Number *</label><input value={tf.contactNumber} onChange={(e) => set({ contactNumber: e.target.value })} className={input} /></div>
          <div><label className={label}>Email ID *</label><input type="email" value={tf.email} onChange={(e) => set({ email: e.target.value })} className={input} /></div>
        </div>
      </div>

      <div>
        <div className={section}>Trip details</div>
        <div className="space-y-3">
          <div><label className={label}>Trip Type *</label>
            <select value={tf.tripType} onChange={(e) => set({ tripType: e.target.value })} className={input}>
              <option>One Way</option><option>Round Trip</option><option>Multi City</option>
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className={label}>Departure City *</label><input value={tf.departureCity} onChange={(e) => set({ departureCity: e.target.value })} placeholder="Delhi" className={input} /></div>
            <div><label className={label}>Arrival City *</label><input value={tf.arrivalCity} onChange={(e) => set({ arrivalCity: e.target.value })} placeholder="Bangalore" className={input} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className={label}>Departure Date *</label><input type="date" min={today} value={tf.departureDate} onChange={(e) => set({ departureDate: e.target.value })} className={input} /></div>
            <div><label className={label}>Preferred Departure Flight Time <span className="font-normal text-slate-400">(lowest fare booked)</span></label><input type="time" value={tf.departureFlightTime} onChange={(e) => set({ departureFlightTime: e.target.value })} className={input} /></div>
          </div>
          {isRound && (
            <div className="grid md:grid-cols-2 gap-3">
              <div><label className={label}>Return Date *</label><input type="date" value={tf.returnDate} min={tf.departureDate || today} onChange={(e) => set({ returnDate: e.target.value })} className={input} /></div>
              <div><label className={label}>Preferred Return Flight Time</label><input type="time" value={tf.returnFlightTime} onChange={(e) => set({ returnFlightTime: e.target.value })} className={input} /></div>
            </div>
          )}
          <div>
            <label className={label}>Reason for Travelling *</label>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {TRAVEL_REASONS.map(r => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={tf.reasons.includes(r)} onChange={() => toggleReason(r)} className="w-4 h-4" />{r}</label>
              ))}
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={tf.reasons.includes("Other")} onChange={() => toggleReason("Other")} className="w-4 h-4" />Other</label>
            </div>
            {tf.reasons.includes("Other") && <input value={tf.reasonOther} onChange={(e) => set({ reasonOther: e.target.value })} placeholder="Please specify" className={`${input} mt-2`} />}
          </div>
        </div>
      </div>

      {isShortNotice && (
        <div className="rounded-lg p-2.5 border bg-amber-50 border-amber-200">
          <div className="text-xs text-amber-900 mb-2">As per company policy, travel must be raised at least {TRAVEL_MIN_LEAD_DAYS} days in advance. This request starts in {leadDays} day(s), so the urgency must be justified.</div>
          <label className={label}>Explain the reason for emergency travel *</label>
          <textarea value={tf.emergencyReason} onChange={(e) => set({ emergencyReason: e.target.value })} rows={2} className={input} />
        </div>
      )}

      <div>
        <div className={section}>Meeting details</div>
        <div className="space-y-3">
          <div><label className={label}>Number of Meetings Aligned *</label><input type="number" min="0" max="20" value={tf.meetingsCount} onChange={(e) => resizeList("meetings", "meetingsCount", e.target.value, () => ({ orgName: "", meetingWith: "" }))} className={input} /></div>
          {tf.meetings.map((m, i) => (
            <div key={i} className="grid md:grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-2">
              <div className="md:col-span-2 text-[11px] font-semibold text-slate-500">Meeting {i + 1}</div>
              <div><label className={label}>Org Name *</label><input value={m.orgName} onChange={(e) => setRow("meetings", i, { orgName: e.target.value })} className={input} /></div>
              <div><label className={label}>Meeting With <span className="font-normal text-slate-400">(optional)</span></label><input value={m.meetingWith} onChange={(e) => setRow("meetings", i, { meetingWith: e.target.value })} className={input} /></div>
            </div>
          ))}
          <div><label className={label}>Total Number of People Travelling <span className="font-normal text-slate-400">(excluding you)</span> *</label><input type="number" min="0" max="20" value={tf.peopleCount} onChange={(e) => resizeList("travellers", "peopleCount", e.target.value, () => ({ name: "", age: "", sex: "" }))} className={input} /></div>
          {tf.travellers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap rounded-lg border border-slate-200 bg-white p-2">
              <span className="text-xs text-slate-500 w-9">#{i + 1}</span>
              <input value={t.name} onChange={(e) => setRow("travellers", i, { name: e.target.value })} placeholder="Full name" className="flex-1 min-w-[150px] px-2 py-1.5 border border-slate-300 rounded text-sm" />
              <input type="number" min="0" value={t.age} onChange={(e) => setRow("travellers", i, { age: e.target.value })} placeholder="Age" className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm" />
              <select value={t.sex} onChange={(e) => setRow("travellers", i, { sex: e.target.value })} className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"><option value="">Sex</option><option value="M">M</option><option value="F">F</option></select>
            </div>
          ))}
          <div><label className={label}>Desired Outcomes *</label><textarea value={tf.desiredOutcomes} onChange={(e) => set({ desiredOutcomes: e.target.value })} rows={2} className={input} /></div>
        </div>
      </div>
    </div>
  );
}
