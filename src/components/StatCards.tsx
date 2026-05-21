export function StatCards({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {items.map((s, i) => {
        const Icon = s.icon;
        const clickable = !!s.onClick;
        return (
          <button key={i} onClick={s.onClick} disabled={!clickable} className={`bg-white rounded-xl p-4 border border-slate-200 text-left transition ${clickable ? "hover:border-blue-400 hover:shadow-md cursor-pointer" : "cursor-default"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{s.label}</div>
              <div className={`w-7 h-7 rounded-lg bg-${s.color}-100 text-${s.color}-600 flex items-center justify-center`}><Icon className="w-3.5 h-3.5" /></div>
            </div>
            <div className="text-xl font-bold text-slate-900">{s.value}</div>
            {clickable && <div className="text-xs text-blue-600 mt-1 font-medium">Click to view →</div>}
          </button>
        );
      })}
    </div>
  );
}
