import { CURRENCIES } from "../constants";

// ============ CURRENCY INPUT ============
export function CurrencyInput({ value, currency, fxRate, onChange, label, required }) {
  const amountINR = currency === "INR" ? parseFloat(value || 0) : parseFloat(value || 0) * parseFloat(fxRate || 0);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label} {required && "*"}</label>
      <div className="flex gap-2">
        <select value={currency} onChange={(e) => {
          const newCurr = e.target.value;
          const newRate = CURRENCIES.find(c => c.code === newCurr)?.defaultRate || 1;
          onChange({ amount: value, currency: newCurr, fxRate: newCurr === "INR" ? 1 : newRate });
        }} className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-sm shrink-0">
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
        <input type="number" value={value} onChange={(e) => onChange({ amount: e.target.value, currency, fxRate })} placeholder="Amount" className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
      {currency !== "INR" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">FX Rate (1 {currency} = ? INR)</label>
            <input type="number" step="0.01" value={fxRate} onChange={(e) => onChange({ amount: value, currency, fxRate: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">= INR Value</label>
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-900">₹{amountINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}
    </div>
  );
}
