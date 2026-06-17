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

  function handleCardClick(data, title) {
    if (data.length === 0) { showToast("Nothing here", "info"); return; }
    setDrillDown({ title, data });
  }

  return (
    <div>
      <StatCards items={[
        { label: "Awaiting My Action", value: inbox.length, color: "amber", icon: Clock, onClick: () => handleCardClick(inbox, "Awaiting My Action") },
        { label: "Payment Requests", value: paymentInbox.length, color: "blue", icon: Wallet, onClick: () => handleCardClick(paymentInbox, "Pending Payment Requests") },
        { label: "PO Requests", value: poInbox.length, color: "fuchsia", icon: FileSignature, onClick: () => handleCardClick(poInbox, "Pending PO Requests") },
        { label: "PI Requests", value: piInbox.length, color: "teal", icon: FileText, onClick: () => handleCardClick(piInbox, "Pending PI Requests") },
        { label: "Budget Requests", value: budgetInbox.length, color: "indigo", icon: PiggyBank, onClick: () => handleCardClick(budgetInbox, "Pending Budget Requests") },
      ]} />
      <RequestList requests={inbox} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} savePICounter={savePICounter} poCounter={poCounter} piCounter={piCounter} emptyMessage="Your inbox is empty." showActions addNotifications={addNotifications} showToast={showToast} />
      {drillDown && <DrillDownModal title={drillDown.title} items={drillDown.data} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
