// ============ ACCESS CONTROL ============

// Seeded department heads with bespoke routing — sub-department scoping (U12 sees
// ODM projects only) or a sanctioned cross-department bridge (U11, the Sales head,
// also handles ODM-SALES work). Their exact visibility/action rules are spelled
// out below. Any OTHER department head (e.g. an account the admin creates) is held
// strictly to their own department: role + department, nothing hardcoded.
const SEEDED_HEAD_IDS = ["U08", "U09", "U10", "U11", "U12", "U15", "U16", "U19"];

export function canUserSeeRequest(user, request) {
  if (request.requesterId === user.id) return true;
  // Finance + executive roles approve across the whole company, so they see all
  // departments' requests. (By design — see the chain of command.)
  if (["CEO", "VP", "FinanceHead", "Accountant", "SuperManager"].includes(user.role)) return true;
  // Seeded heads keep their established (sub-dept / cross-dept-bridge) visibility.
  if (user.id === "U08") return request.dept === "ODM";
  if (user.id === "U12") return request.dept === "ODM" && request.isProject === true;
  if (user.id === "U11") return request.dept === "ODM" || (request.dept === "Sales" && request.scope === "ODM-SALES");
  if (user.id === "U09") return request.dept === "HR";
  if (user.id === "U10") return request.dept === "Product+Marketing";
  if (["U15", "U16", "U19"].includes(user.id)) return request.dept === "Box Build";
  // Any other department head: strictly their own department, nothing else. With
  // no department assigned they see nothing until an admin sets one (the Admin
  // Console flags such accounts).
  if (isHODLevel(user)) return Boolean(user.dept) && request.dept === user.dept;
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
  // R&D cap allocations and allocation requests are config, not workflow items.
  if (request.type === "RDCap" || request.type === "RDCapRequest") return false;
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
      // A department head may only approve/reject work in their OWN department.
      // Seeded heads keep their established routing (incl. the sanctioned ODM-SALES
      // bridge); any other head is held strictly to a matching department. This is
      // what stops, e.g., an ODM head acting on a Box Build employee's request.
      if (isHODLevel(user) && !SEEDED_HEAD_IDS.includes(user.id) && user.dept && request.dept !== user.dept) return false;
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
