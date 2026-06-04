import { useState } from "react";
import { LogOut, Bell, Shield, Clock, FileText, CheckSquare, PiggyBank, FileSignature, Plus, Target, TrendingUp, Building2, Users, UserCog } from "lucide-react";
import { canUserActOnRequest, getUserActionsOnRequest } from "../lib/access";
import { ElecbitsLogo } from "../components/ElecbitsLogo";
import { NotificationPanel } from "../components/NotificationPanel";
import { TabBar } from "../components/TabBar";
import { RequestList } from "../requests/RequestList";
import { NewPaymentRequestForm } from "../forms/NewPaymentRequestForm";
import { NewBudgetRequestForm } from "../forms/NewBudgetRequestForm";
import { NewPORequestForm } from "../forms/NewPORequestForm";
import { InboxView } from "./InboxView";
import { MyRequestsView } from "./MyRequestsView";
import { MyApprovalsView } from "./MyApprovalsView";
import { BudgetView } from "./BudgetView";
import { POListView } from "./POListView";
import { ReportsView } from "./ReportsView";
import { OrgOverview } from "./OrgOverview";
import { AdminUsersView } from "./AdminUsersView";

// ============ DASHBOARD ============
export function Dashboard({ user, requests, budgets, pos, poCounter, notifications, saveRequests, saveBudgets, savePOs, savePOCounter, saveNotifications, addNotifications, showToast, onLogout }) {
  const inbox = [...requests, ...budgets, ...pos].filter(r => canUserActOnRequest(user, r));
  const defaultView = user.role === "Employee" ? "my-requests" : (inbox.length > 0 ? "inbox" : "overview");
  const [view, setView] = useState(defaultView);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const myNotifs = notifications.filter(n => n.toUserId === user.id);
  const unreadCount = myNotifs.filter(n => !n.read).length;

  async function markNotifRead(id) { await saveNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n)); }
  async function markAllRead() { await saveNotifications(notifications.map(n => n.toUserId === user.id ? { ...n, read: true } : n)); }

  const roleColors = { CEO: "amber", VP: "violet", SuperManager: "fuchsia", FinanceHead: "emerald", Accountant: "teal", DeptApprover: "blue", BoxBuildMidApprover: "cyan", Employee: "slate" };
  const roleBadge = { CEO: "CEO", VP: "Vice President", SuperManager: "Manager (Special Access)", FinanceHead: "Finance Head", Accountant: "Accountant", DeptApprover: "Department Head", BoxBuildMidApprover: "Box Build Delivery Head", Employee: "Employee" };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ElecbitsLogo size="md" />
            <div className="hidden sm:block pl-3 border-l border-slate-200">
              <p className="text-xs font-semibold text-slate-700">Finance OS</p>
              <p className="text-xs text-slate-500">Budget · PO · Payment</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="p-2 hover:bg-slate-100 rounded-lg relative">
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifPanel && <NotificationPanel notifications={myNotifs} onClose={() => setShowNotifPanel(false)} onMarkRead={markNotifRead} onMarkAllRead={markAllRead} />}
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{user.designation}</div>
            </div>
            <div className={`w-9 h-9 rounded-full bg-${roleColors[user.role]}-100 text-${roleColors[user.role]}-700 flex items-center justify-center font-bold text-sm`}>
              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>
      <div className={`bg-${roleColors[user.role]}-50 border-b border-${roleColors[user.role]}-200`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          <Shield className={`w-4 h-4 text-${roleColors[user.role]}-700`} />
          <span className={`text-xs font-semibold text-${roleColors[user.role]}-900`}>{roleBadge[user.role]}</span>
          <span className="text-xs text-slate-600">· Dept: <strong>{user.dept}</strong></span>
          {user.role === "CEO" && <span className="text-xs text-slate-600">· Approves ≥ ₹5L</span>}
          {user.role === "VP" && <span className="text-xs text-slate-600">· Approves ≥ ₹1L</span>}
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-5">
        <UnifiedDashboard user={user} view={view} setView={setView} requests={requests} budgets={budgets} pos={pos} poCounter={poCounter} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} inbox={inbox} addNotifications={addNotifications} showToast={showToast} notifications={notifications} />
      </main>
    </div>
  );
}

// ============ UNIFIED DASHBOARD ============
function UnifiedDashboard({ user, view, setView, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, inbox, addNotifications, showToast }) {
  const myItems = [...requests, ...budgets, ...pos].filter(r => r.requesterId === user.id);
  const canViewOrg = ["CEO", "VP", "SuperManager", "FinanceHead", "Accountant"].includes(user.role);
  const canSeeMyApprovals = ["DeptApprover", "BoxBuildMidApprover", "VP", "CEO", "FinanceHead", "SuperManager"].includes(user.role);
  const canViewReports = ["FinanceHead", "CEO", "VP", "SuperManager"].includes(user.role);
  const canManageUsers = ["SuperManager", "CEO"].includes(user.role);

  const myApprovalItems = [...requests, ...budgets, ...pos].filter(r => {
    const a = getUserActionsOnRequest(user, r);
    return a.approvals.length > 0 || a.rejections.length > 0;
  });

  const tabs = [];
  if (inbox.length > 0 || user.role !== "Employee") tabs.push({ id: "inbox", label: "Action - Need to do", icon: Clock, count: inbox.length, highlight: inbox.length > 0 });
  tabs.push({ id: "my-requests", label: "My Requests", icon: FileText, count: myItems.length });
  if (canSeeMyApprovals) tabs.push({ id: "my-approvals", label: "My Approvals", icon: CheckSquare, count: myApprovalItems.length });
  tabs.push({ id: "new-budget", label: "Raise Budget", icon: PiggyBank });
  tabs.push({ id: "new-po", label: "Raise PO", icon: FileSignature });
  tabs.push({ id: "new-payment", label: "Raise Payment", icon: Plus });
  tabs.push({ id: "budgets", label: "All Budgets", icon: Target });
  tabs.push({ id: "pos", label: "All POs", icon: FileSignature });
  if (canViewReports) tabs.push({ id: "reports", label: "Reports", icon: TrendingUp });
  if (canViewOrg) {
    tabs.push({ id: "overview", label: "Org Overview", icon: Building2 });
    tabs.push({ id: "all", label: "All Requests", icon: Users });
  }
  if (canManageUsers) tabs.push({ id: "admin-users", label: "Pending Signups", icon: UserCog });

  const commonProps = { user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, addNotifications, showToast };

  return (
    <div>
      <TabBar tabs={tabs} active={view} setActive={setView} />
      {view === "inbox" && <InboxView {...commonProps} inbox={inbox} />}
      {view === "my-requests" && <MyRequestsView {...commonProps} />}
      {view === "my-approvals" && <MyApprovalsView {...commonProps} />}
      {view === "new-payment" && <NewPaymentRequestForm {...commonProps} onSuccess={() => { showToast("Payment request submitted", "success"); setView("my-requests"); }} />}
      {view === "new-budget" && <NewBudgetRequestForm {...commonProps} onSuccess={() => { showToast("Budget request submitted", "success"); setView("my-requests"); }} />}
      {view === "new-po" && <NewPORequestForm {...commonProps} onSuccess={() => { showToast("PO request submitted", "success"); setView("my-requests"); }} />}
      {view === "budgets" && <BudgetView {...commonProps} />}
      {view === "pos" && <POListView {...commonProps} />}
      {view === "reports" && <ReportsView {...commonProps} />}
      {view === "overview" && <OrgOverview {...commonProps} />}
      {view === "admin-users" && canManageUsers && <AdminUsersView {...commonProps} />}
      {view === "all" && <RequestList {...commonProps} requests={[...requests, ...budgets, ...pos].sort((a, b) => new Date(b.createdDate || b.approvedDate) - new Date(a.createdDate || a.approvedDate))} requests_all={requests} budgets_all={budgets} pos_all={pos} emptyMessage="No requests yet." />}
    </div>
  );
}
