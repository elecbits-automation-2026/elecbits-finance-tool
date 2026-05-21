export function TabBar({ tabs, active, setActive }) {
  return (
    <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${active === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            <Icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${t.highlight ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
