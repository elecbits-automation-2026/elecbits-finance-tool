import { USERS, VP_THRESHOLD, CEO_THRESHOLD } from "../constants";

// ============ APPROVAL WORKFLOW HELPERS ============
export function getEligibleDeptApprovers(requester, selectedType, isProject) {
  const approvers = [];
  if (requester.dept === "ODM" || requester.dept === "Sales") {
    if (requester.scope === "ODM-SALES") {
      approvers.push(USERS.find(u => u.id === "U11"));
    } else if (isProject) {
      approvers.push(USERS.find(u => u.id === "U08"));
      approvers.push(USERS.find(u => u.id === "U12"));
    } else {
      approvers.push(USERS.find(u => u.id === "U08"));
    }
  } else if (requester.dept === "Box Build") {
    approvers.push(USERS.find(u => u.id === "U15"));
    approvers.push(USERS.find(u => u.id === "U16"));
  } else if (requester.dept === "HR") {
    approvers.push(USERS.find(u => u.id === "U09"));
  } else if (requester.dept === "Product+Marketing") {
    approvers.push(USERS.find(u => u.id === "U10"));
  } else if (requester.dept === "Finance") {
    approvers.push(USERS.find(u => u.id === "U06"));
  } else if (requester.dept === "Executive") {
    if (requester.role === "CEO") {
      approvers.push(...USERS.filter(u => u.role === "CEO" && u.id !== requester.id));
    } else if (requester.role === "VP") {
      approvers.push(...USERS.filter(u => u.role === "CEO"));
    }
  } else if (requester.dept === "Management") {
    approvers.push(...USERS.filter(u => u.role === "SuperManager" && u.id !== requester.id));
  }
  return approvers.filter(Boolean);
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

export function getDeptHeadsForDept(dept, isProject = false) {
  const heads = [];
  if (dept === "ODM") {
    heads.push(USERS.find(u => u.id === "U08"));
    if (isProject) heads.push(USERS.find(u => u.id === "U12"));
  } else if (dept === "Sales") heads.push(USERS.find(u => u.id === "U11"));
  else if (dept === "Box Build") {
    heads.push(USERS.find(u => u.id === "U15"));
    heads.push(USERS.find(u => u.id === "U16"));
    heads.push(USERS.find(u => u.id === "U19"));
  } else if (dept === "HR") heads.push(USERS.find(u => u.id === "U09"));
  else if (dept === "Product+Marketing") heads.push(USERS.find(u => u.id === "U10"));
  return heads.filter(Boolean);
}
