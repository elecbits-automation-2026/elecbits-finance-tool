import { VP_THRESHOLD, CEO_THRESHOLD } from "../constants";
import { getRoster } from "./roster";

// ============ APPROVAL WORKFLOW HELPERS ============
// Routing is keyed off a department head's ROLE + SCOPE, never their user id, so any
// account the admin gives the same role/scope is recognised automatically. Candidates
// come from the live roster (getRoster()), so heads created at runtime route correctly.
// `scope` is a per-user mandate (e.g. "ODM-PROJECT" = ODM projects only); a head with
// no special scope simply covers their own department.
const deptApprovers = () => getRoster().filter(u => u.role === "DeptApprover");

function approverScopeCovers(approver, dept, isProject) {
  switch (approver.scope) {
    case "ODM-ALL": return dept === "ODM";
    case "ODM-PROJECT": return dept === "ODM" && isProject === true;
    case "ODM-SALES": return dept === "ODM" || dept === "Sales";
    case "HR": return dept === "HR";
    case "PRODUCT-MARKETING": return dept === "Product+Marketing";
    case "BOXBUILD": return dept === "Box Build";
    default: return Boolean(approver.dept) && approver.dept === dept;
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
  // ODM / Sales: the all-ODM head, plus the project head when this is a project.
  if (dept === "ODM" || dept === "Sales") {
    return deptApprovers().filter(u => u.scope === "ODM-ALL" || (isProject && u.scope === "ODM-PROJECT"));
  }
  // Every other department: the DeptApprover(s) whose mandate covers it.
  return deptApprovers().filter(u => approverScopeCovers(u, dept, isProject));
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
  if (currentStage === "DeptApproval") {
    // PO Edit/Cancel skip VP/CEO
    if (request.kind === "PO" && (request.type === "POEdit" || request.type === "POCancel")) {
      return "FinanceHead";
    }
    if (request.kind === "PO") {
      if (request.amountINR >= CEO_THRESHOLD) return "VP"; // VP first, then SuperManager
      if (request.amountINR >= VP_THRESHOLD) return "VP";
      return "FinanceHead";
    }
    if (request.amountINR >= CEO_THRESHOLD) return "CEO";
    if (request.amountINR >= VP_THRESHOLD) return "VP";
    return "FinanceHead";
  }
  if (currentStage === "VP") {
    if (request.kind === "PO") {
      if (request.amountINR >= CEO_THRESHOLD) return "SuperManagerApproval";
      return "FinanceHead";
    }
    if (request.amountINR >= CEO_THRESHOLD) return "CEO";
    return "FinanceHead";
  }
  if (currentStage === "CEO") return "FinanceHead";
  if (currentStage === "SuperManagerApproval") return "FinanceHead";
  if (currentStage === "FinanceHead") {
    if (request.kind === "Budget") return "Active";
    if (request.kind === "PO") return "Accountant";
    return "Accountant";
  }
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
  if (dept === "Product+Marketing") return deptApprovers().filter(u => u.scope === "PRODUCT-MARKETING");
  return deptApprovers().filter(u => u.dept === dept);
}
