import { useState } from "react";
import { Ban } from "lucide-react";

// ============ CANCEL BUTTON ============
export function CancelButton({ request, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const isBudget = request.kind === "Budget";
  const isPO = request.kind === "PO";

  async function doCancel() {
    if (!reason.trim()) { alert("Reason required"); return; }
    setBusy(true);
    const now = new Date().toISOString();
    const updateFn = (item) => item.id === request.id ? { ...item, status: "Cancelled", currentStage: "Cancelled", history: [...item.history, { action: "Cancelled by requester", by: user.name, byId: user.id, at: now, comments: reason }] } : item;
    if (isBudget) await saveBudgets(budgets_all.map(updateFn));
    else if (isPO) await savePOs(pos_all.map(updateFn));
    else await saveRequests(requests_all.map(updateFn));
    setBusy(false); setShowForm(false); setReason("");
  }

  return (
    <div className="mt-2">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" />Cancel this request</button>
      ) : (
        <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-900">Reason for cancellation</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg" />
          <div className="flex gap-2">
            <button onClick={doCancel} disabled={busy || !reason.trim()} className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirm Cancel</button>
            <button onClick={() => { setShowForm(false); setReason(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Nevermind</button>
          </div>
        </div>
      )}
    </div>
  );
}
