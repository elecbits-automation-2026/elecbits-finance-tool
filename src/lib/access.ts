// ============ ACCESS CONTROL ============
export function canUserSeeRequest(user, request) {
  if (request.requesterId === user.id) return true;
  if (["CEO", "VP", "FinanceHead", "Accountant", "SuperManager"].includes(user.role)) return true;
  if (user.id === "U08") return request.dept === "ODM";
  if (user.id === "U12") return request.dept === "ODM" && request.isProject === true;
  if (user.id === "U11") return request.dept === "ODM" || (request.dept === "Sales" && request.scope === "ODM-SALES");
  if (user.id === "U09") return request.dept === "HR";
  if (user.id === "U10") return request.dept === "Product+Marketing";
  if (["U15", "U16", "U19"].includes(user.id)) return request.dept === "Box Build";
  return false;
}

export function filterByAccess(user, list) {
  return list.filter(item => canUserSeeRequest(user, item));
}

export function getUserActionsOnRequest(user, request) {
  const actions = (request.history || []).filter(h => h.byId === user.id);
  const approvals = actions.filter(h => h.action.includes("Approved") && !h.action.includes("Reject"));
  const rejections = actions.filter(h => h.action.includes("Reject"));
  return { approvals, rejections, all: actions };
}

export function isHODLevel(user) {
  return user.role === "DeptApprover" || user.role === "BoxBuildMidApprover";
}

export function canUserActOnRequest(user, request) {
  if (["Paid", "Rejected", "Cancelled", "Active", "Approved", "Closed"].includes(request.status)) return false;
  // PO at SuperManagerApproval: only SuperManagers (actual approval stage)
  if (request.kind === "PO" && request.currentStage === "SuperManagerApproval") {
    return user.role === "SuperManager";
  }
  if (user.role === "SuperManager") return true;
  const stage = request.currentStage;
  if (stage === "BoxBuildMid" && user.id === "U19") return true;
  if (stage === "DeptApproval") {
    if (request.selectedApprovers && request.selectedApprovers.includes(user.id)) {
      const hasApproved = request.history.some(h => h.byId === user.id && h.action.includes("Approved"));
      if (hasApproved) return false;
      return true;
    }
  }
  if (stage === "VP" && user.role === "VP") return true;
  if (stage === "CEO" && user.role === "CEO") return true;
  if (stage === "FinanceHead" && user.role === "FinanceHead") return true;
  if ((stage === "Accountant" || stage === "Processing") && user.role === "Accountant") return true;
  return false;
}
