import { useState } from "react";
import { Clock, Wallet, FileSignature, FileText, PiggyBank } from "lucide-react";
import { StatCards } from "../components/StatCards";
import { RequestList } from "../requests/RequestList";
import { DrillDownModal } from "../requests/DrillDownModal";

// ============ INBOX ============
export function InboxView({ user, requests, budgets, pos, poCounter, piCounter, saveRequests, saveBudgets, savePOs, savePOCounter, savePICounter, inbox, addNotifications, showToast }) {
  const [drillDown, setDrillDown] = useState(null);
  const paymentInbox = inbox.filter(r => r.kind === "Payment");
  const budgetInbox = inbox.filter(r => r.kind === "Budget");
  const poInbox = inbox.filter(r => r.kind === "PO");
  const piInbox = inbox.filter(r => r.kind === "PI");

  // Inbox drill-downs are actionable: open by `kind` and re-derive the list live
  // from `inbox` so that approving/rejecting an item removes it in place (and the
  // popup auto-closes once the last one is handled).
  function openInbox(kind, title) {
    const src = kind === "all" ? inbox : inbox.filter(r => r.kind === kind);
    if (src.length === 0) { showToast("Nothing here", "info"); return; }
    setDrillDown({ title, kind });
  }
  const liveItems = !drillDown ? [] : drillDown.kind === "all" ? inbox : inbox.filter(r => r.kind === drillDown.kind);

  return (
    <div>
      <StatCards items={[
        { label: "Awaiting My Action", value: inbox.length, color: "amber", icon: Clock, onClick: () => openInbox("all", "Awaiting My Action") },
        { label: "Payment Requests", value: paymentInbox.length, color: "blue", icon: Wallet, onClick: () => openInbox("Payment", "Pending Payment Requests") },
        { label: "PO Requests", value: poInbox.length, color: "fuchsia", icon: FileSignature, onClick: () => openInbox("PO", "Pending PO Requests") },
        { label: "PI Requests", value: piInbox.length, color: "teal", icon: FileText, onClick: () => openInbox("PI", "Pending PI Requests") },
        { label: "Budget Requests", value: budgetInbox.length, color: "indigo", icon: PiggyBank, onClick: () => openInbox("Budget", "Pending Budget Requests") },
      ]} />
      <RequestList requests={inbox} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} savePICounter={savePICounter} poCounter={poCounter} piCounter={piCounter} emptyMessage="Your inbox is empty." showActions addNotifications={addNotifications} showToast={showToast} />
      {drillDown && <DrillDownModal title={drillDown.title} items={liveItems} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} onClose={() => setDrillDown(null)} showActions saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} savePICounter={savePICounter} poCounter={poCounter} piCounter={piCounter} addNotifications={addNotifications} showToast={showToast} />}
    </div>
  );
}
