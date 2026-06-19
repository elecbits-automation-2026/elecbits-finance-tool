// ============ ACCESS CONTROL ============

// Every department a user belongs to: their primary `dept` plus any admin-granted
// `extraDepts`. Used by approval ROUTING (workflow.ts) so a multi-department head
// is reachable for work in any of their departments, regardless of which tab they
// currently have open. A user's own dashboard view, by contrast, is scoped to the
// single active-tab department (the dashboard passes that as `user.dept`).
export function effectiveDepts(user) {
  const extra = Array.isArray(user.extraDepts) ? user.extraDepts : [];
  return user.dept ? [user.dept, ...extra.filter(d => d !== user.dept)] : extra;
}

// A department head sees their own department's requests, full stop — pure
// role + department, no scopes or cross-department bridges. With no department
// assigned they see nothing until an admin sets one (the Admin Console flags
// such accounts).
function headSeesRequest(user, request) {
  return Boolean(user.dept) && request.dept === user.dept;
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
  // Segregation of duties: the requester can NEVER approve or act on their own
  // request — at any stage or in any role. This covers a department head who is also
  // their own routed approver, a Finance Head who raised a budget (who would otherwise
  // approve it at both the Dept and Finance stages), and a SuperManager acting on
  // their own request via the override path below. Independent review is mandatory.
  if (request.requesterId === user.id) return false;
  // PO/PI at SuperManagerApproval: only SuperManagers (actual approval stage)
  if ((request.kind === "PO" || request.kind === "PI") && request.currentStage === "SuperManagerApproval") {
    return user.role === "SuperManager";
  }
  if (user.role === "SuperManager") return true;
  const stage = request.currentStage;
  if (stage === "BoxBuildMid" && user.role === "BoxBuildMidApprover") return true;
  if (stage === "DeptApproval") {
    if (request.selectedApprovers && request.selectedApprovers.includes(user.id)) {
      // A department head may only approve/reject work in their OWN department.
      // This is what stops, e.g., an ODM head acting on a Box Build employee's request.
      if (isHODLevel(user) && user.dept && request.dept !== user.dept) return false;
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
