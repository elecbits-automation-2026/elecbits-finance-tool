import { Bell } from "lucide-react";

export function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }) {
  const sorted = [...notifications].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 30);
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose}></div>
      <div className="absolute top-12 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 z-40 overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm">Notifications</div>
          {notifications.some(n => !n.read) && <button onClick={onMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500"><Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />No notifications yet</div>
          ) : (
            sorted.map(n => (
              <button key={n.id} onClick={() => onMarkRead(n.id)} className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 ${!n.read ? "bg-blue-50/50" : ""}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>}
                  <div className={`flex-1 ${n.read ? "ml-4" : ""}`}>
                    <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(n.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
