import { useState } from "react";
import { FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import { StatCards } from "../components/StatCards";
import { RequestList } from "../requests/RequestList";
import { DrillDownModal } from "../requests/DrillDownModal";

// ============ MY REQUESTS ============
export function MyRequestsView({ user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, addNotifications, showToast }) {
  const myItems = [...requests, ...budgets, ...pos].filter(r => r.requesterId === user.id).sort((a, b) => new Date(b.createdDate || b.approvedDate) - new Date(a.createdDate || a.approvedDate));
  const pending = myItems.filter(r => !["Paid", "Rejected", "Cancelled", "Active", "Approved", "Closed"].includes(r.status));
  const completed = myItems.filter(r => ["Paid", "Active", "Approved", "Closed"].includes(r.status));
  const rejected = myItems.filter(r => r.status === "Rejected");
  const [drillDown, setDrillDown] = useState(null);

  function handleCardClick(data, title) {
    if (data.length === 0) { showToast("Nothing here", "info"); return; }
    setDrillDown({ title, data });
  }

  return (
    <div>
      <StatCards items={[
        { label: "Total Raised", value: myItems.length, color: "blue", icon: FileText, onClick: () => handleCardClick(myItems, "All My Requests") },
        { label: "Pending", value: pending.length, color: "amber", icon: Clock, onClick: () => handleCardClick(pending, "My Pending") },
        { label: "Approved/Paid", value: completed.length, color: "emerald", icon: CheckCircle2, onClick: () => handleCardClick(completed, "My Completed") },
        { label: "Rejected", value: rejected.length, color: "red", icon: XCircle, onClick: () => handleCardClick(rejected, "My Rejected") },
      ]} />
      <RequestList requests={myItems} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} emptyMessage="You haven't raised any requests yet." showCancelResubmit addNotifications={addNotifications} showToast={showToast} />
      {drillDown && <DrillDownModal title={drillDown.title} items={drillDown.data} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
