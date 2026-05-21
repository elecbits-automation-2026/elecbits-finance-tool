import { useState } from "react";
import { X } from "lucide-react";
import { RequestCard } from "./RequestCard";

// ============ DRILL-DOWN ============
export function DrillDownModal({ title, items, user, requests_all, budgets_all, pos_all, onClose }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {items.length === 0 ? <div className="text-center py-10 text-slate-500 text-sm">No items</div> : (
            <div className="space-y-2">
              {items.map(r => <RequestCard key={r.id} request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={() => {}} saveBudgets={() => {}} savePOs={() => {}} expanded={expanded === r.id} setExpanded={setExpanded} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
