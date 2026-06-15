import { VP_THRESHOLD, CEO_THRESHOLD } from "../constants";
import { getRoster } from "./roster";
import { effectiveDepts } from "./access";

// ============ APPROVAL WORKFLOW HELPERS ============
// Routing is keyed off a department head's ROLE + SCOPE, never their user id, so any
// account the admin gives the same role/scope is recognised automatically. Candidates
// come from the live roster (getRoster()), so heads created at runtime route correctly.
// `scope` is a per-user mandate (e.g. "ODM-PROJECT" = ODM projects only); a head with
// no special scope simply covers their own department.
const deptApprovers = () => getRoster().filter(u => u.role === "DeptApprover");

// Does this approver's scope cover `dept`? Only reached from the DEFAULT branch
// of getEligibleDeptApprovers — i.e. for departments OTHER than ODM and Sales,
// which are routed by their own dedicated branches above. So ODM/Sales scopes
// are intentionally absent here: an ODM-scoped head never approves an HR /
// Product / etc. budget, which is exactly what the final `!approver.scope`
// guard yields (an unrecognised or ODM/Sales scope covers nothing here).
function approverScopeCovers(approver, dept) {
  switch (approver.scope) {
    case "HR": return dept === "HR";
    case "BOXBUILD": return dept === "Box Build";
    // No special scope: the approver covers any department they belong to (primary
    // or an admin-granted extra), so a multi-department head is routed work in each.
    default: return !approver.scope && effectiveDepts(approver).includes(dept);
  }
}

export function getEligibleDeptApprovers(requester, selectedType, isProject) {
  const dept = requester.dept;
  // Executive / Management self-approval chains are purely role-based.
  if (dept === "Executive") {
    if (requester.role === "CEO") return getRoster().filter(u => u.role === "CEO" && u.id !== requester.id);
    if (requester.role === "VP") return getRoster().filter(u => u.role === "CEO");
    return [];
  }
  if (dept === "Management") return getRoster().filter(u => u.role === "SuperManager" && u.id !== requester.id);
  // Finance routes to the Finance Head.
  if (dept === "Finance") return getRoster().filter(u => u.role === "FinanceHead");
  // A requester carrying the ODM-SALES bridge scope routes to the ODM-SALES head only.
  if ((dept === "ODM" || dept === "Sales") && requester.scope === "ODM-SALES") {
    return deptApprovers().filter(u => u.scope === "ODM-SALES");
  }
  // Sales: routes to the Sales head, who carries the ODM-SALES scope. Sales work is
  // NOT approved by the ODM-ALL / ODM-PROJECT heads — only the ODM bridge runs the
  // other direction (the Sales head also covers ODM). This matches getDeptHeadsForDept,
  // which already notifies the ODM-SALES head for Sales activity.
  if (dept === "Sales") {
    return deptApprovers().filter(u => u.scope === "ODM-SALES");
  }
  // ODM: the all-ODM head, plus the project head when this is a project.
  if (dept === "ODM") {
    return deptApprovers().filter(u => u.scope === "ODM-ALL" || (isProject && u.scope === "ODM-PROJECT"));
  }
  // Every other department: the DeptApprover(s) whose mandate covers it.
  return deptApprovers().filter(u => approverScopeCovers(u, dept));
}

export function needsBoxBuildMidApproval(requester) {
  return requester.dept === "Box Build" && (requester.designation.includes("Project Manager") || requester.designation.includes("Vendor Manager"));
}

export function computeNextStage(request, currentStage, approver) {
  // Super manager override (only for Payment and Budget, not for PO at SuperManagerApproval which is their actual stage)
  if (approver && approver.role === "SuperManager") {
    if (request.kind !== "PO" || currentStage !== "SuperManagerApproval") {
      if (["BoxBuildMid", "DeptApproval", "VP", "CEO", "FinanceHead"].includes(currentStage)) {
        if (request.kind === "Budget") return "Active";
        if (request.kind === "PO") return "Accountant";
        return "Accountant";
      }
    }
  }
  if (currentStage === "BoxBuildMid") return "DeptApproval";
  // Finance reviews FIRST, immediately after the department head, then the request
  // escalates up the executive chain (VP → CEO / SuperManager) by amount. This holds
  // for all three flows — Budget, Payment and PO — so the Finance Head is always the
  // first sign-off after the department and never the last.
  if (currentStage === "DeptApproval") return "FinanceHead";
  if (currentStage === "FinanceHead") {
    // PO Edit/Cancel are not re-escalated up the chain — straight to processing.
    if (request.kind === "PO" && (request.type === "POEdit" || request.type === "POCancel")) {
      return "Accountant";
    }
    // Budgets at or above the CEO threshold are reviewed by BOTH the VP and the CEO
    // (VP first — the VP stage below escalates to CEO for those amounts), matching the
    // form's FlowPreview.
    if (request.kind === "Budget") {
      if (request.amountINR >= VP_THRESHOLD) return "VP";
      return "Active";
    }
    if (request.kind === "PO") {
      if (request.amountINR >= VP_THRESHOLD) return "VP"; // VP first, then SuperManager for ≥5L
      return "Accountant";
    }
    // Payments keep their existing straight-to-CEO routing (no VP) at ≥5L.
    if (request.amountINR >= CEO_THRESHOLD) return "CEO";
    if (request.amountINR >= VP_THRESHOLD) return "VP";
    return "Accountant";
  }
  if (currentStage === "VP") {
    if (request.kind === "Budget") {
      if (request.amountINR >= CEO_THRESHOLD) return "CEO";
      return "Active";
    }
    if (request.kind === "PO") {
      if (request.amountINR >= CEO_THRESHOLD) return "SuperManagerApproval";
      return "Accountant";
    }
    return "Accountant"; // Payment: VP is only reached in the 1L–5L tier
  }
  if (currentStage === "CEO") {
    if (request.kind === "Budget") return "Active";
    return "Accountant"; // Payment
  }
  if (currentStage === "SuperManagerApproval") return "Accountant";
  if (currentStage === "Accountant") {
    if (request.kind === "PO") return "Approved";
    return "Paid";
  }
  return currentStage;
}

export function getStageLabel(stage, kind = "Payment") {
  if (kind === "Budget") {
    return {
      "BoxBuildMid": "Pending Delivery Head",
      "DeptApproval": "Pending Dept Head",
      "VP": "Pending VP",
      "CEO": "Pending CEO",
      "FinanceHead": "Pending Finance Head",
      "Active": "Active Budget",
      "Rejected": "Rejected",
      "Cancelled": "Cancelled",
    }[stage] || stage;
  }
  if (kind === "PO") {
    return {
      "BoxBuildMid": "Pending Delivery Head (Arun)",
      "DeptApproval": "Pending Dept Head",
      "VP": "Pending VP",
      "SuperManagerApproval": "Pending Stuti + Sarthak",
      "FinanceHead": "Pending Finance Head",
      "Accountant": "Pending PO Number Assignment",
      "Approved": "Approved",
      "Closed": "Closed",
      "Rejected": "Rejected",
      "Cancelled": "Cancelled",
    }[stage] || stage;
  }
  return {
    "BoxBuildMid": "Pending Delivery Head (Arun)",
    "DeptApproval": "Pending Dept Approval",
    "VP": "Pending VP",
    "CEO": "Pending CEO",
    "FinanceHead": "Pending Finance Head",
    "Accountant": "Pending Accountant Processing",
    "Processing": "Processing Payment",
    "Paid": "Paid",
    "Rejected": "Rejected",
    "Cancelled": "Cancelled",
  }[stage] || stage;
}

// Heads to notify for a department's activity. Like getEligibleDeptApprovers but also
// includes the Box Build mid-approver (Delivery Head) so they stay in the loop.
export function getDeptHeadsForDept(dept, isProject = false) {
  if (dept === "ODM") return deptApprovers().filter(u => u.scope === "ODM-ALL" || (isProject && u.scope === "ODM-PROJECT"));
  if (dept === "Sales") return deptApprovers().filter(u => u.scope === "ODM-SALES");
  if (dept === "Box Build") return getRoster().filter(u => (u.role === "DeptApprover" && u.scope === "BOXBUILD") || u.role === "BoxBuildMidApprover");
  if (dept === "HR") return deptApprovers().filter(u => u.scope === "HR");
  return deptApprovers().filter(u => effectiveDepts(u).includes(dept));
}
