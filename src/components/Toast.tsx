export function Toast({ toast }) {
  const colors = { info: "bg-slate-900 text-white", success: "bg-emerald-600 text-white", warning: "bg-amber-500 text-white", error: "bg-red-600 text-white" };
  return <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100]"><div className={`${colors[toast.type]} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium`}>{toast.message}</div></div>;
}
