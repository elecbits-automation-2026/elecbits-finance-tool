// ============ FINANCE / BUDGET / PO HELPERS ============

// Helper: compute line item totals
export function computeLineItemTotals(lineItems) {
  let subtotal = 0;
  let totalGST = 0;
  (lineItems || []).forEach(li => {
    const qty = parseFloat(li.qty || 0);
    const cost = parseFloat(li.unitCost || 0);
    const gstPct = parseFloat(li.gstPct || 0);
    const lineSubtotal = qty * cost;
    subtotal += lineSubtotal;
    totalGST += lineSubtotal * (gstPct / 100);
  });
  return { subtotal, totalGST, grandTotal: subtotal + totalGST };
}

export function isImageFile(type) { return type && type.startsWith("image/"); }
export function isPdfFile(type) { return type === "application/pdf"; }

export function getActiveBudgetForProject(budgets, projectId) {
  return budgets.find(b => b.type === "Project" && b.projectId === projectId && (b.status === "Active" || b.status === "Active Budget" || b.currentStage === "Active"));
}

export function getActiveMonthlyBudget(budgets, dept, category, month) {
  return budgets.find(b =>
    b.type === "Monthly" && b.dept === dept && b.category === category && b.month === month &&
    (b.status === "Active" || b.status === "Active Budget" || b.currentStage === "Active")
  );
}

export function getMonthlyBudgetUsage(requests, dept, category, month) {
  const matching = requests.filter(r => {
    if (r.dept !== dept) return false;
    if (r.expenseTypeName !== category) return false;
    if (["Rejected", "Cancelled"].includes(r.status)) return false;
    const rMonth = (r.createdDate || "").slice(0, 7);
    return rMonth === month;
  });
  const paid = matching.filter(r => r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
  const committed = matching.filter(r => r.status !== "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
  return { paid, committed, total: paid + committed };
}

// PO helpers
export function getApprovedPOs(pos) {
  return pos.filter(po => po.type === "POCreate" && (po.status === "Approved" || po.currentStage === "Approved"));
}
export function getApprovedPOsForProject(pos, projectId) {
  return getApprovedPOs(pos).filter(po => po.projectId === projectId);
}
export function getApprovedPOsForDept(pos, dept) {
  return getApprovedPOs(pos).filter(po => !po.isProject && po.dept === dept);
}
export function getPOUsage(requests, poId) {
  const matching = requests.filter(r => r.linkedPOId === poId && !["Rejected", "Cancelled"].includes(r.status));
  const paid = matching.filter(r => r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
  const committed = matching.filter(r => r.status !== "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
  return { paid, committed, total: paid + committed };
}
export function getPOAvailable(po, requests) {
  if (po.status === "Cancelled" || po.currentStage === "Cancelled") return 0;
  const usage = getPOUsage(requests, po.id);
  return Math.max(0, po.amountINR - usage.total);
}
export function formatPONumber(num) { return `Az-PO-2526-${String(num).padStart(4, "0")}`; }
