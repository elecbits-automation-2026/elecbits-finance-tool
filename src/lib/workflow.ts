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
  // Every other department: its own DeptApprover(s) — the head(s) whose
  // department(s) include it. Pure role + department, no special scopes/bridges.
  return deptApprovers().filter(u => effectiveDepts(u).includes(dept));
}

export function needsBoxBuildMidApproval(requester) {
  return requester.dept === "Box Build" && (requester.designation.includes("Project Manager") || requester.designation.includes("Vendor Manager"));
}

export function computeNextStage(request, currentStage, approver) {
  // PI follows the exact same routing as PO throughout this function.
  const isPOorPI = request.kind === "PO" || request.kind === "PI";
  const isEditOrCancel = ["POEdit", "POCancel", "PIEdit", "PICancel"].includes(request.type);
  // Super manager override (only for Payment and Budget, not for PO/PI at SuperManagerApproval which is their actual stage)
  if (approver && approver.role === "SuperManager") {
    if (!(isPOorPI && currentStage === "SuperManagerApproval")) {
      if (["BoxBuildMid", "DeptApproval", "VP", "CEO", "FinanceHead"].includes(currentStage)) {
        if (request.kind === "Budget") return "Active";
        if (isPOorPI) return "Accountant";
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
    // PO/PI Edit/Cancel are not re-escalated up the chain — straight to processing.
    if (isPOorPI && isEditOrCancel) {
      return "Accountant";
    }
    // Budgets at or above the CEO threshold are reviewed by BOTH the VP and the CEO
    // (VP first — the VP stage below escalates to CEO for those amounts), matching the
    // form's FlowPreview.
    if (request.kind === "Budget") {
      if (request.amountINR >= VP_THRESHOLD) return "VP";
      return "Active";
    }
    if (isPOorPI) {
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
    if (isPOorPI) {
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
    if (isPOorPI) return "Approved";
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
  if (kind === "PO" || kind === "PI") {
    return {
      "BoxBuildMid": "Pending Delivery Head (Arun)",
      "DeptApproval": "Pending Dept Head",
      "VP": "Pending VP",
      "SuperManagerApproval": "Pending Stuti + Sarthak",
      "FinanceHead": "Pending Finance Head",
      "Accountant": kind === "PI" ? "Pending PI Number Assignment" : "Pending PO Number Assignment",
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
  const heads = deptApprovers().filter(u => effectiveDepts(u).includes(dept));
  if (dept === "Box Build") return [...heads, ...getRoster().filter(u => u.role === "BoxBuildMidApprover")];
  return heads;
}
