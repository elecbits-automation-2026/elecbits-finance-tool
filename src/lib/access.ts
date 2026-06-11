// ============ ACCESS CONTROL ============

// A department head's visibility is driven by their `scope` (a per-user mandate),
// not their identity — sub-department scoping (ODM-PROJECT sees ODM projects only) or
// a sanctioned cross-department bridge (ODM-SALES, the Sales head, also handles ODM
// work). Any head with no special scope is held strictly to their own department, so
// an account the admin creates works without touching this file.
function headSeesRequest(user, request) {
  switch (user.scope) {
    case "ODM-ALL": return request.dept === "ODM";
    case "ODM-PROJECT": return request.dept === "ODM" && request.isProject === true;
    case "ODM-SALES": return request.dept === "ODM" || (request.dept === "Sales" && request.scope === "ODM-SALES");
    case "HR": return request.dept === "HR";
    case "BOXBUILD": return request.dept === "Box Build";
    // No special scope (incl. the Box Build mid-approver): own department only. With
    // no department assigned they see nothing until an admin sets one (the Admin
    // Console flags such accounts).
    default: return Boolean(user.dept) && request.dept === user.dept;
  }
}

export function canUserSeeRequest(user, request) {
  if (request.requesterId === user.id) return true;
  // Finance + executive roles approve across the whole company, so they see all
  // departments' requests. (By design — see the chain of command.)
  if (["CEO", "VP", "FinanceHead", "Accountant", "SuperManager"].includes(user.role)) return true;
  // Department heads see what their scope covers.
  if (isHODLevel(user)) return headSeesRequest(user, request);
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

// Read-only employees (catalog rank 0) are pure viewers: they may see their own
// department's budgets but cannot raise any request or act on the workflow.
// Admin-assigned only — accounts never self-sign-up into this role.
export function isReadOnly(user) {
  return user.role === "EmployeeReadOnly";
}

// Single gate the UI uses to decide whether to offer the "Raise …" actions.
export function canRaiseRequests(user) {
  return !isReadOnly(user);
}

export function canUserActOnRequest(user, request) {
  // Read-only accounts never participate in the workflow.
  if (isReadOnly(user)) return false;
  // R&D cap allocations and allocation requests are config, not workflow items.
  if (request.type === "RDCap" || request.type === "RDCapRequest") return false;
  if (["Paid", "Rejected", "Cancelled", "Active", "Approved", "Closed"].includes(request.status)) return false;
  // PO at SuperManagerApproval: only SuperManagers (actual approval stage)
  if (request.kind === "PO" && request.currentStage === "SuperManagerApproval") {
    return user.role === "SuperManager";
  }
  if (user.role === "SuperManager") return true;
  const stage = request.currentStage;
  if (stage === "BoxBuildMid" && user.role === "BoxBuildMidApprover") return true;
  if (stage === "DeptApproval") {
    if (request.selectedApprovers && request.selectedApprovers.includes(user.id)) {
      // A department head may only approve/reject work in their OWN department. Heads
      // with a scope keep their established routing (incl. the sanctioned ODM-SALES
      // bridge); a head with no scope is held strictly to a matching department. This
      // is what stops, e.g., an ODM head acting on a Box Build employee's request.
      if (isHODLevel(user) && !user.scope && user.dept && request.dept !== user.dept) return false;
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
