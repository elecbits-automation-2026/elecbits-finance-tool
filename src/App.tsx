import { useState, useEffect } from "react";
import { LogOut, DollarSign, Plus, Clock, CheckCircle2, XCircle, AlertTriangle, FileText, Users, Wallet, TrendingUp, Eye, Send, Building2, Shield, Key, Upload, X, RotateCcw, Ban, Briefcase, Target, Paperclip, PiggyBank, Coins, Bell, Filter, Undo2, CheckSquare, FileSignature, Edit3, History } from "lucide-react";

// ============ USER DATABASE ============
const USERS = [
  { id: "U01", email: "saurav@elecbits.in", password: "ceo123", name: "Saurav Kumar", dept: "Executive", designation: "CEO", role: "CEO" },
  { id: "U02", email: "nikhil@elecbits.in", password: "ceo123", name: "Nikhil Rawat", dept: "Executive", designation: "CEO", role: "CEO" },
  { id: "U03", email: "mahendra@elecbits.in", password: "vp123", name: "Mahendra Mehra", dept: "Executive", designation: "VP", role: "VP" },
  { id: "U04", email: "stuti@elecbits.in", password: "god123", name: "Stuti Gupta", dept: "Management", designation: "Manager (Special Access)", role: "SuperManager" },
  { id: "U05", email: "sarthak@elecbits.in", password: "god123", name: "Sarthak Jain", dept: "Management", designation: "Manager (Special Access)", role: "SuperManager" },
  { id: "U06", email: "ravi@elecbits.in", password: "fin123", name: "Ravi Goel", dept: "Finance", designation: "Finance Head", role: "FinanceHead" },
  { id: "U07", email: "divyanshu@elecbits.in", password: "acc123", name: "Divyanshu Pandey", dept: "Finance", designation: "Accountant", role: "Accountant" },
  { id: "U08", email: "shreya@elecbits.in", password: "mgr123", name: "Shreya", dept: "ODM", designation: "Manager", role: "DeptApprover", scope: "ODM-ALL" },
  { id: "U09", email: "khyati@elecbits.in", password: "mgr123", name: "Khyati Wadhwani", dept: "HR", designation: "Manager", role: "DeptApprover", scope: "HR" },
  { id: "U10", email: "harsh.saini@elecbits.in", password: "mgr123", name: "Harsh Saini", dept: "Product+Marketing", designation: "Manager", role: "DeptApprover", scope: "PRODUCT-MARKETING" },
  { id: "U11", email: "ankit@elecbits.in", password: "sls123", name: "Ankit Wadhawan", dept: "Sales", designation: "Sales Manager", role: "DeptApprover", scope: "ODM-SALES" },
  { id: "U12", email: "akash@elecbits.in", password: "pmh123", name: "Akash Sharma", dept: "ODM", designation: "ODM Project Manager Head", role: "DeptApprover", scope: "ODM-PROJECT" },
  { id: "U13", email: "anunay@elecbits.in", password: "emp123", name: "Anunay Dixit", dept: "ODM", designation: "ODM Project Manager", role: "Employee" },
  { id: "U14", email: "chhavi@elecbits.in", password: "emp123", name: "Chhavi Bhatia", dept: "ODM", designation: "ODM Project Manager", role: "Employee" },
  { id: "U15", email: "kunal@elecbits.in", password: "bbh123", name: "Kunal Karir", dept: "Box Build", designation: "Box Build Department Head", role: "DeptApprover", scope: "BOXBUILD" },
  { id: "U16", email: "vinay@elecbits.in", password: "bbh123", name: "Vinay Solanki", dept: "Box Build", designation: "Box Build Department Head", role: "DeptApprover", scope: "BOXBUILD" },
  { id: "U17", email: "varun@elecbits.in", password: "emp123", name: "Varun Pathak", dept: "Box Build", designation: "Box Build Project Manager", role: "Employee" },
  { id: "U18", email: "harsh.shrivastava@elecbits.in", password: "emp123", name: "Harsh Shrivastava", dept: "Box Build", designation: "Box Build Vendor Manager", role: "Employee" },
  { id: "U19", email: "arun@elecbits.in", password: "bbd123", name: "Arun Pratap Singh", dept: "Box Build", designation: "Box Build Delivery Head", role: "BoxBuildMidApprover" },
  { id: "U20", email: "himanshu@elecbits.in", password: "emp123", name: "Himanshu Bharadwaj", dept: "HR", designation: "HR Associate", role: "Employee" },
  { id: "U21", email: "priyanshu@elecbits.in", password: "emp123", name: "Priyanshu Jain", dept: "HR", designation: "HR Associate", role: "Employee" },
];

// ============ CONFIG ============
const VP_THRESHOLD = 100000;
const CEO_THRESHOLD = 500000;
const PROFIT_MARGIN = 0.20;
const MAX_BUDGET_RATIO = 0.80;
const RD_MONTHLY_CAP = 200000;
const NON_PROJECT_DEPTS = ["HR", "Finance", "Product+Marketing"];

const CURRENCIES = [
  { code: "INR", symbol: "₹", defaultRate: 1 },
  { code: "USD", symbol: "$", defaultRate: 84 },
  { code: "EUR", symbol: "€", defaultRate: 91 },
  { code: "GBP", symbol: "£", defaultRate: 107 },
  { code: "AED", symbol: "AED", defaultRate: 23 },
  { code: "SGD", symbol: "S$", defaultRate: 62 },
  { code: "JPY", symbol: "¥", defaultRate: 0.54 },
  { code: "CNY", symbol: "¥", defaultRate: 11.8 },
  { code: "AUD", symbol: "A$", defaultRate: 55 },
  { code: "CAD", symbol: "C$", defaultRate: 60 },
];

const EXPENSE_TYPES = [
  { id: "VP-PROJ", name: "Vendor Payment (Project)", category: "Project", requiresProject: true },
  { id: "PA-PROJ", name: "Project Asset Purchase", category: "Project", requiresProject: true },
  { id: "PT-PROJ", name: "Project Travel", category: "Project", requiresProject: true },
  { id: "PC-PROJ", name: "Project Consultant Fee", category: "Project", requiresProject: true },
  { id: "TA", name: "Travel & Accommodation", category: "Non-Project" },
  { id: "AS", name: "Assets (Non-Project)", category: "Non-Project" },
  { id: "SW", name: "Software & Subscriptions", category: "Non-Project" },
  { id: "OS", name: "Office Supplies", category: "Non-Project" },
  { id: "ME", name: "Marketing Events", category: "Non-Project" },
  { id: "TD", name: "Training & Development", category: "Non-Project" },
  { id: "PS", name: "Professional Services", category: "Non-Project" },
  { id: "SP", name: "Salary & Payroll", category: "Non-Project" },
  { id: "ER", name: "Employee Reimbursements", category: "Non-Project" },
  { id: "UE", name: "Utilities & Office Expenses", category: "Non-Project" },
  { id: "MI", name: "Miscellaneous", category: "Non-Project" },
];

const SEED_BUDGETS = [
  { id: "BUD-001", type: "Project", projectType: "Client", projectId: "EB-21-ML-334-02-1576", projectName: "ML Project 334", dept: "ODM", client: "Client A", clientOrderValue: 10625000, clientOrderValueCurrency: "INR", clientOrderValueFxRate: 1, amount: 8500000, currency: "INR", fxRate: 1, amountINR: 8500000, status: "Active", currentStage: "Active", approvedBy: "Saurav Kumar (CEO)", approvedDate: "2026-03-15", requesterName: "Akash Sharma", requesterId: "U12", history: [{ action: "Approved", by: "Saurav Kumar", at: "2026-03-15T10:00:00.000Z", comments: "Client PO received" }] },
  { id: "BUD-002", type: "Project", projectType: "Client", projectId: "EB-02-EL-242-02-1577", projectName: "Electronics Project 242", dept: "ODM", client: "Client B", clientOrderValue: 15000000, clientOrderValueCurrency: "INR", clientOrderValueFxRate: 1, amount: 12000000, currency: "INR", fxRate: 1, amountINR: 12000000, status: "Active", currentStage: "Active", approvedBy: "Nikhil Rawat (CEO)", approvedDate: "2026-02-20", requesterName: "Akash Sharma", requesterId: "U12", history: [{ action: "Approved", by: "Nikhil Rawat", at: "2026-02-20T10:00:00.000Z", comments: "" }] },
  { id: "BUD-003", type: "Project", projectType: "Client", projectId: "EB-33-BB-501-01-2001", projectName: "Box Build Project 501", dept: "Box Build", client: "Client C", clientOrderValue: 8125000, clientOrderValueCurrency: "INR", clientOrderValueFxRate: 1, amount: 6500000, currency: "INR", fxRate: 1, amountINR: 6500000, status: "Active", currentStage: "Active", approvedBy: "Saurav Kumar (CEO)", approvedDate: "2026-01-10", requesterName: "Kunal Karir", requesterId: "U15", history: [{ action: "Approved", by: "Saurav Kumar", at: "2026-01-10T10:00:00.000Z", comments: "" }] },
  { id: "BUD-004", type: "Project", projectType: "RD", rdType: "Prototype", projectId: "EB-RD-SMARTPLUG-APR2026", projectName: "Smart Plug Prototype", dept: "ODM", amount: 80000, currency: "INR", fxRate: 1, amountINR: 80000, status: "Active", currentStage: "Active", approvedBy: "Mahendra Mehra (VP)", approvedDate: "2026-04-05", requesterName: "Anunay Dixit", requesterId: "U13", justification: "Developing in-house prototype for potential client pitch", expectedOutcome: "Working smart plug prototype with Wi-Fi connectivity", history: [{ action: "Approved", by: "Mahendra Mehra", at: "2026-04-05T10:00:00.000Z", comments: "Approved for internal prototype dev" }] },
  { id: "BUD-005", type: "Project", projectType: "RD", rdType: "Sample Development", projectId: "EB-RD-SENSOR-APR2026", projectName: "IoT Sensor Sample", dept: "ODM", amount: 60000, currency: "INR", fxRate: 1, amountINR: 60000, status: "Active", currentStage: "Active", approvedBy: "Saurav Kumar (CEO)", approvedDate: "2026-04-12", requesterName: "Chhavi Bhatia", requesterId: "U14", justification: "Sample for Client D demo scheduled in May", expectedOutcome: "Working sample for client demo", history: [{ action: "Approved", by: "Saurav Kumar", at: "2026-04-12T10:00:00.000Z", comments: "" }] },
  { id: "BUD-M001", type: "Monthly", dept: "HR", category: "Travel & Accommodation", month: "2026-04", amount: 80000, currency: "INR", fxRate: 1, amountINR: 80000, status: "Active", currentStage: "Active", approvedBy: "Ravi Goel (Finance Head)", approvedDate: "2026-04-01", requesterName: "Khyati Wadhwani", requesterId: "U09", scope: "Monthly travel pool for HR team activities", history: [{ action: "Approved", by: "Ravi Goel", at: "2026-04-01T10:00:00.000Z", comments: "April HR travel pool" }] },
  { id: "BUD-M002", type: "Monthly", dept: "HR", category: "Employee Reimbursements", month: "2026-04", amount: 100000, currency: "INR", fxRate: 1, amountINR: 100000, status: "Active", currentStage: "Active", approvedBy: "Ravi Goel (Finance Head)", approvedDate: "2026-04-01", requesterName: "Khyati Wadhwani", requesterId: "U09", scope: "Monthly reimbursement pool", history: [{ action: "Approved", by: "Ravi Goel", at: "2026-04-01T10:00:00.000Z", comments: "" }] },
  { id: "BUD-M003", type: "Monthly", dept: "Product+Marketing", category: "Marketing Events", month: "2026-04", amount: 250000, currency: "INR", fxRate: 1, amountINR: 250000, status: "Active", currentStage: "Active", approvedBy: "Saurav Kumar (CEO)", approvedDate: "2026-04-01", requesterName: "Harsh Saini", requesterId: "U10", scope: "April events budget", history: [{ action: "Approved", by: "Saurav Kumar", at: "2026-04-01T10:00:00.000Z", comments: "" }] },
  { id: "BUD-M004", type: "Monthly", dept: "Product+Marketing", category: "Software & Subscriptions", month: "2026-04", amount: 150000, currency: "INR", fxRate: 1, amountINR: 150000, status: "Active", currentStage: "Active", approvedBy: "Ravi Goel (Finance Head)", approvedDate: "2026-04-01", requesterName: "Harsh Saini", requesterId: "U10", scope: "SaaS tools", history: [{ action: "Approved", by: "Ravi Goel", at: "2026-04-01T10:00:00.000Z", comments: "" }] },
  { id: "BUD-M005", type: "Monthly", dept: "Finance", category: "Software & Subscriptions", month: "2026-04", amount: 30000, currency: "INR", fxRate: 1, amountINR: 30000, status: "Active", currentStage: "Active", approvedBy: "Saurav Kumar (CEO)", approvedDate: "2026-04-01", requesterName: "Ravi Goel", requesterId: "U06", scope: "Finance tools", history: [{ action: "Approved", by: "Saurav Kumar", at: "2026-04-01T10:00:00.000Z", comments: "" }] },
];

const SEED_POS = [
  { id: "PO-SEED-001", kind: "PO", type: "POCreate", poNumber: "Az-PO-2526-0001", createdDate: "2026-03-20T10:00:00.000Z", approvedDate: "2026-03-22T10:00:00.000Z", requesterId: "U13", requesterName: "Anunay Dixit", dept: "ODM", isProject: true, projectId: "EB-21-ML-334-02-1576",
    supplierName: "Acme Components Pvt Ltd", supplierAddress: "Plot 12, Phase 2, Noida, UP 201301", supplierGST: "09AABCA1234A1ZP", isInternational: false, supplierCountry: "", supplierTaxId: "",
    lineItems: [
      { id: "L1", description: "Microcontroller boards (BOM v2.1)", qty: 1000, unit: "pcs", unitCost: 1200, gstPct: 18 },
      { id: "L2", description: "Custom PCB assembly", qty: 100, unit: "pcs", unitCost: 600, gstPct: 18 },
    ],
    subtotal: 1260000, totalGST: 226800, amount: 1486800, currency: "INR", fxRate: 1, amountINR: 1486800,
    scope: "Supply of microcontroller boards as per BOM v2.1 and custom PCB assemblies",
    deliveryTimeline: "6 weeks from PO date", paymentTerms: "Advance 30% / Balance on Delivery",
    currentStage: "Approved", status: "Approved", version: 1, editHistory: [], selectedApprovers: ["U08", "U12"], approvedBy: "Divyanshu Pandey (Accountant)",
    history: [{ action: "Submitted", by: "Anunay Dixit", at: "2026-03-20T10:00:00.000Z", comments: "PO request raised" }, { action: "Approved (Dept)", by: "Akash Sharma", at: "2026-03-20T14:00:00.000Z", comments: "Verified supplier" }, { action: "Approved by VP", by: "Mahendra Mehra", at: "2026-03-21T10:00:00.000Z", comments: "" }, { action: "Approved by Stuti Gupta", by: "Stuti Gupta", at: "2026-03-21T14:00:00.000Z", comments: "OK" }, { action: "Approved by Finance Head", by: "Ravi Goel", at: "2026-03-22T09:00:00.000Z", comments: "" }, { action: "PO Number Assigned: Az-PO-2526-0001", by: "Divyanshu Pandey", at: "2026-03-22T10:00:00.000Z", comments: "" }] },
  { id: "PO-SEED-002", kind: "PO", type: "POCreate", poNumber: "Az-PO-2526-0002", createdDate: "2026-04-01T10:00:00.000Z", approvedDate: "2026-04-03T10:00:00.000Z", requesterId: "U17", requesterName: "Varun Pathak", dept: "Box Build", isProject: true, projectId: "EB-33-BB-501-01-2001",
    supplierName: "Steel Frame Industries", supplierAddress: "Industrial Area, Faridabad, HR 121002", supplierGST: "06AAACS5678B1ZK", isInternational: false, supplierCountry: "", supplierTaxId: "",
    lineItems: [
      { id: "L1", description: "Steel enclosures with custom branding", qty: 500, unit: "pcs", unitCost: 1200, gstPct: 18 },
      { id: "L2", description: "Mounting brackets", qty: 500, unit: "sets", unitCost: 200, gstPct: 18 },
    ],
    subtotal: 700000, totalGST: 126000, amount: 826000, currency: "INR", fxRate: 1, amountINR: 826000,
    scope: "Steel enclosures with custom branding and mounting brackets for 500 units",
    deliveryTimeline: "4 weeks", paymentTerms: "Net 30",
    currentStage: "Approved", status: "Approved", version: 1, editHistory: [], selectedApprovers: ["U15", "U16"], approvedBy: "Divyanshu Pandey (Accountant)",
    history: [{ action: "Submitted", by: "Varun Pathak", at: "2026-04-01T10:00:00.000Z", comments: "PO request raised" }, { action: "Approved by Delivery Head", by: "Arun Pratap Singh", at: "2026-04-01T14:00:00.000Z", comments: "" }, { action: "Approved (Dept)", by: "Kunal Karir", at: "2026-04-02T10:00:00.000Z", comments: "" }, { action: "Approved by VP", by: "Mahendra Mehra", at: "2026-04-02T14:00:00.000Z", comments: "" }, { action: "Approved by Finance Head", by: "Ravi Goel", at: "2026-04-03T09:00:00.000Z", comments: "" }, { action: "PO Number Assigned: Az-PO-2526-0002", by: "Divyanshu Pandey", at: "2026-04-03T10:00:00.000Z", comments: "" }] },
];

const STORAGE_KEY_REQUESTS = "elecbits_fos_requests_v3";
const STORAGE_KEY_BUDGETS = "elecbits_fos_budgets_v4";
const STORAGE_KEY_NOTIFS = "elecbits_fos_notifs_v1";
const STORAGE_KEY_POS = "elecbits_fos_pos_v3";
const STORAGE_KEY_PO_COUNTER = "elecbits_fos_po_counter_v3";

// GSTIN regex (15 chars, Indian format)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{4}[0-9A-Z]{1}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_RATES = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = ["pcs", "kg", "hours", "services", "units", "mtr", "sets", "lot", "other"];

// Helper: compute line item totals
function computeLineItemTotals(lineItems) {
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

// ============ ACCESS CONTROL ============
function canUserSeeRequest(user, request) {
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

function filterByAccess(user, list) {
  return list.filter(item => canUserSeeRequest(user, item));
}

function getUserActionsOnRequest(user, request) {
  const actions = (request.history || []).filter(h => h.byId === user.id);
  const approvals = actions.filter(h => h.action.includes("Approved") && !h.action.includes("Reject"));
  const rejections = actions.filter(h => h.action.includes("Reject"));
  return { approvals, rejections, all: actions };
}

// ============ HELPERS ============
function getEligibleDeptApprovers(requester, selectedType, isProject) {
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

function needsBoxBuildMidApproval(requester) {
  return requester.dept === "Box Build" && (requester.designation.includes("Project Manager") || requester.designation.includes("Vendor Manager"));
}

function isHODLevel(user) {
  return user.role === "DeptApprover" || user.role === "BoxBuildMidApprover";
}

function computeNextStage(request, currentStage, approver) {
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

function getStageLabel(stage, kind = "Payment") {
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

function canUserActOnRequest(user, request) {
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

function isImageFile(type) { return type && type.startsWith("image/"); }
function isPdfFile(type) { return type === "application/pdf"; }

function getActiveBudgetForProject(budgets, projectId) {
  return budgets.find(b => b.type === "Project" && b.projectId === projectId && (b.status === "Active" || b.status === "Active Budget" || b.currentStage === "Active"));
}

function getActiveMonthlyBudget(budgets, dept, category, month) {
  return budgets.find(b =>
    b.type === "Monthly" && b.dept === dept && b.category === category && b.month === month &&
    (b.status === "Active" || b.status === "Active Budget" || b.currentStage === "Active")
  );
}

function getMonthlyBudgetUsage(requests, dept, category, month) {
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
function getApprovedPOs(pos) {
  return pos.filter(po => po.type === "POCreate" && (po.status === "Approved" || po.currentStage === "Approved"));
}
function getApprovedPOsForProject(pos, projectId) {
  return getApprovedPOs(pos).filter(po => po.projectId === projectId);
}
function getApprovedPOsForDept(pos, dept) {
  return getApprovedPOs(pos).filter(po => !po.isProject && po.dept === dept);
}
function getPOUsage(requests, poId) {
  const matching = requests.filter(r => r.linkedPOId === poId && !["Rejected", "Cancelled"].includes(r.status));
  const paid = matching.filter(r => r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
  const committed = matching.filter(r => r.status !== "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
  return { paid, committed, total: paid + committed };
}
function getPOAvailable(po, requests) {
  if (po.status === "Cancelled" || po.currentStage === "Cancelled") return 0;
  const usage = getPOUsage(requests, po.id);
  return Math.max(0, po.amountINR - usage.total);
}
function formatPONumber(num) { return `Az-PO-2526-${String(num).padStart(4, "0")}`; }

function getDeptHeadsForDept(dept, isProject = false) {
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

// ============ LOGO ============
function ElecbitsLogo({ size = "md", showTagline = false }) {
  const sizes = { sm: { text: "text-lg", tag: "text-[10px]" }, md: { text: "text-2xl", tag: "text-xs" }, lg: { text: "text-4xl", tag: "text-sm" } };
  const s = sizes[size] || sizes.md;
  return (
    <div className="flex flex-col leading-none">
      <span className={`font-black tracking-tight text-blue-700 ${s.text}`} style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "-0.02em" }}>Elecbits</span>
      {showTagline && <span className={`text-slate-500 font-medium mt-0.5 ${s.tag}`}>Finance OS</span>}
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pos, setPOs] = useState([]);
  const [poCounter, setPOCounter] = useState(2);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().catch(err => {
      console.error("Fatal load error:", err);
      // Use seed data as fallback
      setBudgets(SEED_BUDGETS);
      setPOs(SEED_POS);
      setPOCounter(2);
      setLoading(false);
    });
  }, []);

  async function loadData() {
    // Requests
    try {
      const r = await window.storage.get(STORAGE_KEY_REQUESTS, true);
      if (r && r.value) setRequests(JSON.parse(r.value));
    } catch (err) {
      console.log("No requests in storage yet:", err?.message);
      setRequests([]);
    }

    // Budgets
    try {
      const b = await window.storage.get(STORAGE_KEY_BUDGETS, true);
      if (b && b.value) {
        setBudgets(JSON.parse(b.value));
      } else {
        setBudgets(SEED_BUDGETS);
        try { await window.storage.set(STORAGE_KEY_BUDGETS, JSON.stringify(SEED_BUDGETS), true); } catch (e) { console.log("Seed budget save failed:", e?.message); }
      }
    } catch (err) {
      console.log("Budget load failed, using seed:", err?.message);
      setBudgets(SEED_BUDGETS);
      try { await window.storage.set(STORAGE_KEY_BUDGETS, JSON.stringify(SEED_BUDGETS), true); } catch {}
    }

    // POs
    try {
      const p = await window.storage.get(STORAGE_KEY_POS, true);
      if (p && p.value) {
        setPOs(JSON.parse(p.value));
      } else {
        setPOs(SEED_POS);
        try { await window.storage.set(STORAGE_KEY_POS, JSON.stringify(SEED_POS), true); } catch (e) { console.log("Seed PO save failed:", e?.message); }
      }
    } catch (err) {
      console.log("PO load failed, using seed:", err?.message);
      setPOs(SEED_POS);
      try { await window.storage.set(STORAGE_KEY_POS, JSON.stringify(SEED_POS), true); } catch {}
    }

    // PO Counter
    try {
      const c = await window.storage.get(STORAGE_KEY_PO_COUNTER, true);
      if (c && c.value) {
        setPOCounter(parseInt(c.value));
      } else {
        setPOCounter(2);
        try { await window.storage.set(STORAGE_KEY_PO_COUNTER, "2", true); } catch {}
      }
    } catch (err) {
      console.log("PO counter load failed, using 2:", err?.message);
      setPOCounter(2);
    }

    // Notifications
    try {
      const n = await window.storage.get(STORAGE_KEY_NOTIFS, true);
      if (n && n.value) setNotifications(JSON.parse(n.value));
    } catch (err) {
      console.log("Notifications load failed:", err?.message);
      setNotifications([]);
    }

    // Always set loading false at the end
    setLoading(false);
  }

  async function saveRequests(v) { setRequests(v); try { await window.storage.set(STORAGE_KEY_REQUESTS, JSON.stringify(v), true); } catch {} }
  async function saveBudgets(v) { setBudgets(v); try { await window.storage.set(STORAGE_KEY_BUDGETS, JSON.stringify(v), true); } catch {} }
  async function savePOs(v) { setPOs(v); try { await window.storage.set(STORAGE_KEY_POS, JSON.stringify(v), true); } catch {} }
  async function savePOCounter(v) { setPOCounter(v); try { await window.storage.set(STORAGE_KEY_PO_COUNTER, String(v), true); } catch {} }
  async function saveNotifications(v) { setNotifications(v); try { await window.storage.set(STORAGE_KEY_NOTIFS, JSON.stringify(v), true); } catch {} }
  function showToast(message, type = "info") { setToast({ message, type, id: Date.now() }); setTimeout(() => setToast(null), 3000); }
  async function addNotifications(newOnes) { await saveNotifications([...newOnes, ...notifications]); }

  function handleLogin(email, password) {
    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
    if (user) { setCurrentUser(user); return { success: true }; }
    return { success: false, error: "Invalid email or password" };
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-slate-500">Loading…</div></div>;
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;
  return (
    <>
      <Dashboard user={currentUser} requests={requests} budgets={budgets} pos={pos} poCounter={poCounter} notifications={notifications} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} saveNotifications={saveNotifications} addNotifications={addNotifications} showToast={showToast} onLogout={() => setCurrentUser(null)} />
      {toast && <Toast toast={toast} />}
    </>
  );
}

function Toast({ toast }) {
  const colors = { info: "bg-slate-900 text-white", success: "bg-emerald-600 text-white", warning: "bg-amber-500 text-white", error: "bg-red-600 text-white" };
  return <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100]"><div className={`${colors[toast.type]} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium`}>{toast.message}</div></div>;
}

// ============ LOGIN ============
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showHints, setShowHints] = useState(false);

  function submit() {
    setError("");
    if (!email || !password) { setError("Please enter both email and password"); return; }
    const r = onLogin(email, password);
    if (!r.success) setError(r.error);
  }

  const groupedUsers = [
    { role: "CEO", emoji: "🎯", users: USERS.filter(u => u.role === "CEO") },
    { role: "VP", emoji: "⭐", users: USERS.filter(u => u.role === "VP") },
    { role: "Special Access Managers", emoji: "🔐", users: USERS.filter(u => u.role === "SuperManager") },
    { role: "Finance", emoji: "💰", users: USERS.filter(u => u.role === "FinanceHead" || u.role === "Accountant") },
    { role: "Department Heads", emoji: "👔", users: USERS.filter(u => u.role === "DeptApprover" || u.role === "BoxBuildMidApprover") },
    { role: "Employees", emoji: "👤", users: USERS.filter(u => u.role === "Employee") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <ElecbitsLogo size="lg" showTagline />
            <p className="text-xs text-slate-500 mt-2">Budget · PO · Payment Management</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-sm text-slate-600 mb-6">Sign in with your @elecbits.in email</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="yourname@elecbits.in" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Enter password" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" />{error}</div>}
            <button onClick={submit} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg">Sign In</button>
            <button onClick={() => setShowHints(!showHints)} className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium">{showHints ? "Hide" : "Show"} test credentials</button>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-white" />
            <h3 className="text-white font-bold text-sm">Quick Login (21 Users)</h3>
          </div>
          <p className="text-white/70 text-xs mb-4">Click any user to auto-login.</p>
          {!showHints ? (
            <div className="text-white/60 text-sm text-center py-8">Click "Show test credentials" to see all users</div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {groupedUsers.map((g) => g.users.length > 0 && (
                <div key={g.role}>
                  <div className="text-white/80 text-xs font-bold mt-2 mb-1">{g.emoji} {g.role}</div>
                  {g.users.map((u) => (
                    <button key={u.email} onClick={() => setTimeout(() => onLogin(u.email, u.password), 50)} className="w-full text-left bg-white/5 hover:bg-white/15 rounded-lg px-3 py-2 text-xs transition border border-white/10">
                      <div className="text-white font-semibold">{u.name}</div>
                      <div className="text-white/60">{u.designation} · {u.dept}</div>
                      <div className="text-blue-200 font-mono text-[10px] mt-0.5">{u.email}</div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard({ user, requests, budgets, pos, poCounter, notifications, saveRequests, saveBudgets, savePOs, savePOCounter, saveNotifications, addNotifications, showToast, onLogout }) {
  const inbox = [...requests, ...budgets, ...pos].filter(r => canUserActOnRequest(user, r));
  const defaultView = user.role === "Employee" ? "my-requests" : (inbox.length > 0 ? "inbox" : "overview");
  const [view, setView] = useState(defaultView);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const myNotifs = notifications.filter(n => n.toUserId === user.id);
  const unreadCount = myNotifs.filter(n => !n.read).length;

  async function markNotifRead(id) { await saveNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n)); }
  async function markAllRead() { await saveNotifications(notifications.map(n => n.toUserId === user.id ? { ...n, read: true } : n)); }

  const roleColors = { CEO: "amber", VP: "violet", SuperManager: "fuchsia", FinanceHead: "emerald", Accountant: "teal", DeptApprover: "blue", BoxBuildMidApprover: "cyan", Employee: "slate" };
  const roleBadge = { CEO: "CEO", VP: "Vice President", SuperManager: "Manager (Special Access)", FinanceHead: "Finance Head", Accountant: "Accountant", DeptApprover: "Department Head", BoxBuildMidApprover: "Box Build Delivery Head", Employee: "Employee" };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ElecbitsLogo size="md" />
            <div className="hidden sm:block pl-3 border-l border-slate-200">
              <p className="text-xs font-semibold text-slate-700">Finance OS</p>
              <p className="text-xs text-slate-500">Budget · PO · Payment</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="p-2 hover:bg-slate-100 rounded-lg relative">
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifPanel && <NotificationPanel notifications={myNotifs} onClose={() => setShowNotifPanel(false)} onMarkRead={markNotifRead} onMarkAllRead={markAllRead} />}
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{user.designation}</div>
            </div>
            <div className={`w-9 h-9 rounded-full bg-${roleColors[user.role]}-100 text-${roleColors[user.role]}-700 flex items-center justify-center font-bold text-sm`}>
              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>
      <div className={`bg-${roleColors[user.role]}-50 border-b border-${roleColors[user.role]}-200`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          <Shield className={`w-4 h-4 text-${roleColors[user.role]}-700`} />
          <span className={`text-xs font-semibold text-${roleColors[user.role]}-900`}>{roleBadge[user.role]}</span>
          <span className="text-xs text-slate-600">· Dept: <strong>{user.dept}</strong></span>
          {user.role === "CEO" && <span className="text-xs text-slate-600">· Approves ≥ ₹5L</span>}
          {user.role === "VP" && <span className="text-xs text-slate-600">· Approves ≥ ₹1L</span>}
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-5">
        <UnifiedDashboard user={user} view={view} setView={setView} requests={requests} budgets={budgets} pos={pos} poCounter={poCounter} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} inbox={inbox} addNotifications={addNotifications} showToast={showToast} notifications={notifications} />
      </main>
    </div>
  );
}

function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }) {
  const sorted = [...notifications].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose}></div>
      <div className="absolute top-12 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 z-40 overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm">Notifications</div>
          {notifications.some(n => !n.read) && <button onClick={onMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500"><Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />No notifications yet</div>
          ) : (
            sorted.map(n => (
              <button key={n.id} onClick={() => onMarkRead(n.id)} className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 ${!n.read ? "bg-blue-50/50" : ""}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>}
                  <div className={`flex-1 ${n.read ? "ml-4" : ""}`}>
                    <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(n.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ============ UNIFIED DASHBOARD ============
function UnifiedDashboard({ user, view, setView, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, inbox, addNotifications, showToast }) {
  const myItems = [...requests, ...budgets, ...pos].filter(r => r.requesterId === user.id);
  const canViewOrg = ["CEO", "VP", "SuperManager", "FinanceHead", "Accountant"].includes(user.role);
  const canSeeMyApprovals = ["DeptApprover", "BoxBuildMidApprover", "VP", "CEO", "FinanceHead", "SuperManager"].includes(user.role);
  const canViewReports = ["FinanceHead", "CEO", "VP", "SuperManager"].includes(user.role);

  const myApprovalItems = [...requests, ...budgets, ...pos].filter(r => {
    const a = getUserActionsOnRequest(user, r);
    return a.approvals.length > 0 || a.rejections.length > 0;
  });

  const tabs = [];
  if (inbox.length > 0 || user.role !== "Employee") tabs.push({ id: "inbox", label: "Action Needed", icon: Clock, count: inbox.length, highlight: inbox.length > 0 });
  tabs.push({ id: "my-requests", label: "My Requests", icon: FileText, count: myItems.length });
  if (canSeeMyApprovals) tabs.push({ id: "my-approvals", label: "My Approvals", icon: CheckSquare, count: myApprovalItems.length });
  tabs.push({ id: "new-budget", label: "Raise Budget", icon: PiggyBank });
  tabs.push({ id: "new-po", label: "Raise PO", icon: FileSignature });
  tabs.push({ id: "new-payment", label: "Raise Payment", icon: Plus });
  tabs.push({ id: "budgets", label: "All Budgets", icon: Target });
  tabs.push({ id: "pos", label: "All POs", icon: FileSignature });
  if (canViewReports) tabs.push({ id: "reports", label: "Reports", icon: TrendingUp });
  if (canViewOrg) {
    tabs.push({ id: "overview", label: "Org Overview", icon: Building2 });
    tabs.push({ id: "all", label: "All Requests", icon: Users });
  }

  const commonProps = { user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, addNotifications, showToast };

  return (
    <div>
      <TabBar tabs={tabs} active={view} setActive={setView} />
      {view === "inbox" && <InboxView {...commonProps} inbox={inbox} />}
      {view === "my-requests" && <MyRequestsView {...commonProps} />}
      {view === "my-approvals" && <MyApprovalsView {...commonProps} />}
      {view === "new-payment" && <NewPaymentRequestForm {...commonProps} onSuccess={() => { showToast("Payment request submitted", "success"); setView("my-requests"); }} />}
      {view === "new-budget" && <NewBudgetRequestForm {...commonProps} onSuccess={() => { showToast("Budget request submitted", "success"); setView("my-requests"); }} />}
      {view === "new-po" && <NewPORequestForm {...commonProps} onSuccess={() => { showToast("PO request submitted", "success"); setView("my-requests"); }} />}
      {view === "budgets" && <BudgetView {...commonProps} />}
      {view === "pos" && <POListView {...commonProps} />}
      {view === "reports" && <ReportsView {...commonProps} />}
      {view === "overview" && <OrgOverview {...commonProps} />}
      {view === "all" && <RequestList {...commonProps} requests={[...requests, ...budgets, ...pos].sort((a, b) => new Date(b.createdDate || b.approvedDate) - new Date(a.createdDate || a.approvedDate))} requests_all={requests} budgets_all={budgets} pos_all={pos} emptyMessage="No requests yet." />}
    </div>
  );
}

// ============ INBOX ============
function InboxView({ user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, inbox, addNotifications, showToast }) {
  const [drillDown, setDrillDown] = useState(null);
  const paymentInbox = inbox.filter(r => r.kind === "Payment");
  const budgetInbox = inbox.filter(r => r.kind === "Budget");
  const poInbox = inbox.filter(r => r.kind === "PO");

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
        { label: "Budget Requests", value: budgetInbox.length, color: "indigo", icon: PiggyBank, onClick: () => handleCardClick(budgetInbox, "Pending Budget Requests") },
      ]} />
      <RequestList requests={inbox} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} emptyMessage="Your inbox is empty." showActions addNotifications={addNotifications} showToast={showToast} />
      {drillDown && <DrillDownModal title={drillDown.title} items={drillDown.data} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} onClose={() => setDrillDown(null)} />}
    </div>
  );
}

// ============ MY REQUESTS ============
function MyRequestsView({ user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, addNotifications, showToast }) {
  const myItems = [...requests, ...budgets, ...pos].filter(r => r.requesterId === user.id).sort((a, b) => new Date(b.createdDate || b.approvedDate) - new Date(a.createdDate || a.approvedDate));
  const pending = myItems.filter(r => !["Paid", "Rejected", "Cancelled", "Active", "Approved", "Closed"].includes(r.status));
  const completed = myItems.filter(r => ["Paid", "Active", "Approved", "Closed"].includes(r.status));
  const rejected = myItems.filter(r => r.status === "Rejected");
  const [drillDown, setDrillDown] = useState(null);

  function handleCardClick(data, title) {
    if (data.length === 0) { showToast("Nothing here", "info"); return; }
    setDrillDown({ title, data });
  }

  return (
    <div>
      <StatCards items={[
        { label: "Total Raised", value: myItems.length, color: "blue", icon: FileText, onClick: () => handleCardClick(myItems, "All My Requests") },
        { label: "Pending", value: pending.length, color: "amber", icon: Clock, onClick: () => handleCardClick(pending, "My Pending") },
        { label: "Approved/Paid", value: completed.length, color: "emerald", icon: CheckCircle2, onClick: () => handleCardClick(completed, "My Completed") },
        { label: "Rejected", value: rejected.length, color: "red", icon: XCircle, onClick: () => handleCardClick(rejected, "My Rejected") },
      ]} />
      <RequestList requests={myItems} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} emptyMessage="You haven't raised any requests yet." showCancelResubmit addNotifications={addNotifications} showToast={showToast} />
      {drillDown && <DrillDownModal title={drillDown.title} items={drillDown.data} user={user} requests_all={requests} budgets_all={budgets} pos_all={pos} onClose={() => setDrillDown(null)} />}
    </div>
  );
}

// ============ MY APPROVALS ============
function MyApprovalsView({ user, requests, budgets, pos, poCounter, saveRequests, saveBudgets, savePOs, savePOCounter, addNotifications, showToast }) {
  const [typeTab, setTypeTab] = useState("payment");
  const [filter, setFilter] = useState("all");

  const allItems = typeTab === "payment" ? requests : typeTab === "budget" ? budgets : pos;
  const myActionItems = allItems.filter(r => {
    const a = getUserActionsOnRequest(user, r);
    return a.approvals.length > 0 || a.rejections.length > 0;
  });

  const filtered = myActionItems.filter(r => {
    const a = getUserActionsOnRequest(user, r);
    if (filter === "approved") return a.approvals.length > 0 && a.rejections.length === 0;
    if (filter === "rejected") return a.rejections.length > 0;
    return true;
  });

  const approvedCount = myActionItems.filter(r => { const a = getUserActionsOnRequest(user, r); return a.approvals.length > 0 && a.rejections.length === 0; }).length;
  const rejectedCount = myActionItems.filter(r => getUserActionsOnRequest(user, r).rejections.length > 0).length;

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTypeTab("payment")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${typeTab === "payment" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><Wallet className="w-4 h-4 inline mr-1" />Payments</button>
        <button onClick={() => setTypeTab("po")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${typeTab === "po" ? "bg-fuchsia-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><FileSignature className="w-4 h-4 inline mr-1" />POs</button>
        <button onClick={() => setTypeTab("budget")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${typeTab === "budget" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><PiggyBank className="w-4 h-4 inline mr-1" />Budgets</button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === "all" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>All ({myActionItems.length})</button>
        <button onClick={() => setFilter("approved")} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === "approved" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><CheckCircle2 className="w-3 h-3 inline mr-0.5" />Approved ({approvedCount})</button>
        <button onClick={() => setFilter("rejected")} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === "rejected" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><XCircle className="w-3 h-3 inline mr-0.5" />Rejected ({rejectedCount})</button>
      </div>
      <RequestList
        requests={filtered.sort((a, b) => {
          const aA = getUserActionsOnRequest(user, a).all[0];
          const bA = getUserActionsOnRequest(user, b).all[0];
          return new Date(bA?.at || 0) - new Date(aA?.at || 0);
        })}
        user={user} requests_all={requests} budgets_all={budgets} pos_all={pos}
        saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter}
        emptyMessage={`You haven't ${filter === "all" ? "acted on any" : filter} ${typeTab} requests yet.`}
        addNotifications={addNotifications} showToast={showToast}
      />
    </div>
  );
}

// ============ DRILL-DOWN ============
function DrillDownModal({ title, items, user, requests_all, budgets_all, pos_all, onClose }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {items.length === 0 ? <div className="text-center py-10 text-slate-500 text-sm">No items</div> : (
            <div className="space-y-2">
              {items.map(r => <RequestCard key={r.id} request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={() => {}} saveBudgets={() => {}} savePOs={() => {}} expanded={expanded === r.id} setExpanded={setExpanded} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ CURRENCY INPUT ============
function CurrencyInput({ value, currency, fxRate, onChange, label, required }) {
  const amountINR = currency === "INR" ? parseFloat(value || 0) : parseFloat(value || 0) * parseFloat(fxRate || 0);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label} {required && "*"}</label>
      <div className="flex gap-2">
        <select value={currency} onChange={(e) => {
          const newCurr = e.target.value;
          const newRate = CURRENCIES.find(c => c.code === newCurr)?.defaultRate || 1;
          onChange({ amount: value, currency: newCurr, fxRate: newCurr === "INR" ? 1 : newRate });
        }} className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-sm shrink-0">
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
        <input type="number" value={value} onChange={(e) => onChange({ amount: e.target.value, currency, fxRate })} placeholder="Amount" className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
      {currency !== "INR" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">FX Rate (1 {currency} = ? INR)</label>
            <input type="number" step="0.01" value={fxRate} onChange={(e) => onChange({ amount: value, currency, fxRate: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">= INR Value</label>
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-900">₹{amountINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ NEW PAYMENT REQUEST FORM ============
function NewPaymentRequestForm({ user, requests, budgets, pos, saveRequests, onSuccess, resubmitFrom = null }) {
  const [form, setForm] = useState(resubmitFrom ? {
    expenseTypeId: resubmitFrom.expenseTypeId,
    projectId: resubmitFrom.projectId || "",
    vendor: resubmitFrom.vendor || "",
    description: resubmitFrom.description || "",
    purpose: resubmitFrom.purpose || "",
    amount: resubmitFrom.amount || "",
    currency: resubmitFrom.currency || "INR",
    fxRate: resubmitFrom.fxRate || 1,
    travelFrom: resubmitFrom.travelFrom || "",
    travelTo: resubmitFrom.travelTo || "",
    travelDates: resubmitFrom.travelDates || "",
    invoiceNumber: resubmitFrom.invoiceNumber || "",
    selectedApproverIds: [],
    attachment: null,
    linkedPOId: resubmitFrom.linkedPOId || "",
  } : {
    expenseTypeId: "", projectId: "", vendor: "", description: "", purpose: "",
    amount: "", currency: "INR", fxRate: 1,
    travelFrom: "", travelTo: "", travelDates: "", invoiceNumber: "",
    selectedApproverIds: [], attachment: null, linkedPOId: "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedType = EXPENSE_TYPES.find(t => t.id === form.expenseTypeId);
  const isProject = selectedType?.requiresProject || false;
  const isTravel = selectedType?.name.includes("Travel");
  const isVendorPayment = selectedType?.name.includes("Vendor Payment");
  const amountINR = form.currency === "INR" ? parseFloat(form.amount || 0) : parseFloat(form.amount || 0) * parseFloat(form.fxRate || 0);

  const eligibleApprovers = getEligibleDeptApprovers(user, selectedType, isProject);
  const needsMid = needsBoxBuildMidApproval(user);
  const isOdmProject = user.dept === "ODM" && isProject && user.role === "Employee";
  const isMultiApprover = eligibleApprovers.length > 1;

  const activeBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBudget = (!isProject && selectedType) ? getActiveMonthlyBudget(budgets, user.dept, selectedType.name, currentMonth) : null;
  const monthlyUsage = monthlyBudget ? getMonthlyBudgetUsage(requests, user.dept, selectedType.name, currentMonth) : null;
  const monthlyAvailable = monthlyBudget ? Math.max(0, monthlyBudget.amountINR - monthlyUsage.total) : 0;

  const projectPOs = isProject && form.projectId ? getApprovedPOsForProject(pos, form.projectId) : [];
  const deptPOs = !isProject && selectedType ? getApprovedPOsForDept(pos, user.dept) : [];
  const linkedPO = form.linkedPOId ? pos.find(p => p.id === form.linkedPOId) : null;
  const poUsage = linkedPO ? getPOUsage(requests, linkedPO.id) : null;
  const poAvailable = linkedPO ? getPOAvailable(linkedPO, requests) : 0;

  // Check if linked PO has a pending edit request
  function hasPendingEdit(poId) {
    return pos.some(p => p.type === "POEdit" && p.editingPOId === poId && !["Approved", "Rejected", "Cancelled"].includes(p.status));
  }
  const linkedPOHasPendingEdit = linkedPO ? hasPendingEdit(linkedPO.id) : false;

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } });
      setErr("");
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (!form.expenseTypeId) return setErr("Select expense type");
    if (!form.description.trim()) return setErr("Description required");
    if (!form.amount || amountINR <= 0) return setErr("Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");
    if (isProject && !form.projectId) return setErr("Project ID required");
    if (!isProject && !form.purpose.trim()) return setErr("Purpose mandatory");
    if (!form.attachment) return setErr("Attachment is mandatory");

    let selectedApproverIds = [];
    if (isOdmProject) selectedApproverIds = eligibleApprovers.map(a => a.id);
    else if (isMultiApprover) {
      if (form.selectedApproverIds.length === 0) return setErr("Select an approver");
      selectedApproverIds = form.selectedApproverIds;
    } else if (eligibleApprovers.length === 1) selectedApproverIds = [eligibleApprovers[0].id];

    if (isProject) {
      const budget = getActiveBudgetForProject(budgets, form.projectId);
      if (!budget) return setErr("No active budget for this project. Raise a budget request first.");
      const projReqs = requests.filter(r => r.projectId === form.projectId && !["Rejected", "Cancelled"].includes(r.status));
      const projCommitted = projReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);
      const available = budget.amountINR - projCommitted;
      if (available - amountINR < 0) return setErr(`Exceeds project budget. Available: ₹${(available / 100000).toFixed(2)}L.`);
      if (!form.linkedPOId) return setErr("PO is mandatory for project payments. Select an approved PO.");
    }

    if (!isProject && selectedType) {
      if (!monthlyBudget) return setErr(`No active Monthly Budget for ${user.dept} → ${selectedType.name} for ${currentMonth}. Ask Dept Head to raise one first.`);
      if (amountINR > monthlyAvailable) return setErr(`Exceeds Monthly Budget pool. Available: ₹${(monthlyAvailable / 1000).toFixed(1)}K.`);
    }

    if (form.linkedPOId) {
      const po = pos.find(p => p.id === form.linkedPOId);
      if (!po) return setErr("Selected PO not found.");
      if (po.status === "Cancelled") return setErr("This PO has been cancelled.");
      const avail = getPOAvailable(po, requests);
      if (amountINR > avail) return setErr(`Exceeds PO available balance. PO ${po.poNumber} available: ₹${(avail / 100000).toFixed(2)}L.`);
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const initialStage = needsMid ? "BoxBuildMid" : "DeptApproval";
    const linkedPOInfo = form.linkedPOId ? pos.find(p => p.id === form.linkedPOId) : null;
    const newRequest = {
      id: "EXP-" + Date.now(), kind: "Payment", createdDate: now,
      requesterId: user.id, requesterName: user.name, requesterEmail: user.email, dept: user.dept,
      expenseTypeId: form.expenseTypeId, expenseTypeName: selectedType.name, category: selectedType.category,
      isProject, projectId: form.projectId, vendor: form.vendor, description: form.description, purpose: form.purpose,
      amount: parseFloat(form.amount), currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR,
      travelFrom: form.travelFrom, travelTo: form.travelTo, travelDates: form.travelDates,
      invoiceNumber: form.invoiceNumber, attachment: form.attachment,
      linkedPOId: form.linkedPOId || null, linkedPONumber: linkedPOInfo?.poNumber || null,
      selectedApprovers: selectedApproverIds,
      currentStage: initialStage, status: getStageLabel(initialStage),
      resubmittedFrom: resubmitFrom?.id || null,
      history: [
        ...(resubmitFrom ? [{ action: "Resubmitted", by: user.name, byId: user.id, at: now, comments: `From ${resubmitFrom.id}` }] : []),
        { action: "Submitted", by: user.name, byId: user.id, at: now, comments: "Payment request raised" + (linkedPOInfo ? ` against PO ${linkedPOInfo.poNumber}` : "") }
      ],
    };
    await saveRequests([newRequest, ...requests]);
    setSubmitting(false);
    onSuccess();
  }

  const flowSteps = [user.name];
  if (needsMid) flowSteps.push("Arun (Delivery Head)");
  if (isOdmProject) flowSteps.push("Shreya + Akash (both)");
  else if (isMultiApprover && form.selectedApproverIds.length > 0) flowSteps.push(form.selectedApproverIds.map(id => USERS.find(u => u.id === id)?.name).filter(Boolean).join(" + "));
  else if (eligibleApprovers.length === 1) flowSteps.push(eligibleApprovers[0].name);
  else if (isMultiApprover) flowSteps.push("<select approver>");
  if (amountINR >= VP_THRESHOLD && amountINR < CEO_THRESHOLD) flowSteps.push("Mahendra (VP)");
  if (amountINR >= CEO_THRESHOLD) flowSteps.push("VP + CEO");
  flowSteps.push("Ravi (Finance Head)");
  flowSteps.push("Divyanshu (Accountant)");

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      {resubmitFrom && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Resubmitting from {resubmitFrom.id}</div>
            <div className="text-xs text-amber-800 mt-0.5">Edit and resubmit. Original rejected request stays in audit log.</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">Raise Payment Request</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">For project expenses, both an approved Budget AND an approved PO are mandatory.</p>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
            <input value={user.dept} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expense Type *</label>
            <select value={form.expenseTypeId} onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value, selectedApproverIds: [], linkedPOId: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select type</option>
              {!NON_PROJECT_DEPTS.includes(user.dept) && (
                <optgroup label="Project Expenses (Budget + PO required)">
                  {EXPENSE_TYPES.filter(t => t.category === "Project").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              )}
              <optgroup label="Non-Project Expenses">
                {EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            </select>
            {NON_PROJECT_DEPTS.includes(user.dept) && <p className="text-xs text-slate-500 mt-1">{user.dept} cannot raise project expenses.</p>}
          </div>
        </div>

        {isProject && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project (must have approved budget) *</label>
            {activeBudgets.length === 0 ? (
              <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 inline mr-1" />No active project budgets.
              </div>
            ) : (
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, linkedPOId: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select project</option>
                {activeBudgets.map(b => {
                  const projReqs = requests.filter(r => r.projectId === b.projectId && !["Rejected", "Cancelled"].includes(r.status));
                  const committed = projReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);
                  const avail = b.amountINR - committed;
                  const tag = b.projectType === "RD" ? "[R&D] " : "[Client] ";
                  return <option key={b.projectId} value={b.projectId}>{tag}{b.projectId} — {b.projectName} (₹{(avail / 100000).toFixed(2)}L avail)</option>;
                })}
              </select>
            )}
          </div>
        )}

        {/* PO selection for project */}
        {isProject && form.projectId && (
          <div className={`rounded-lg p-3 border ${projectPOs.length === 0 ? "bg-red-50 border-red-200" : "bg-fuchsia-50 border-fuchsia-200"}`}>
            <label className="block text-xs font-bold text-fuchsia-900 mb-1.5">
              <FileSignature className="w-3.5 h-3.5 inline mr-1" />Linked PO * (mandatory for project payments)
            </label>
            {projectPOs.length === 0 ? (
              <div className="text-xs text-red-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />No approved POs for this project. Raise a PO Request first.
              </div>
            ) : (
              <>
                <select value={form.linkedPOId} onChange={(e) => setForm({ ...form, linkedPOId: e.target.value })} className="w-full px-3 py-2 border border-fuchsia-300 rounded-lg text-sm bg-white">
                  <option value="">Select an approved PO</option>
                  {projectPOs.map(po => {
                    const avail = getPOAvailable(po, requests);
                    const editing = hasPendingEdit(po.id) ? " ⚠ edit pending" : "";
                    return <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(avail / 100000).toFixed(2)}L avail of ₹{(po.amountINR / 100000).toFixed(2)}L){editing}</option>;
                  })}
                </select>
                {linkedPO && (
                  <div className="mt-2 text-xs text-fuchsia-800 bg-white rounded p-2 border border-fuchsia-200">
                    <div className="font-semibold">{linkedPO.poNumber} · {linkedPO.supplierName}</div>
                    <div>Approved: ₹{(linkedPO.amountINR / 100000).toFixed(2)}L · Used: ₹{(poUsage.total / 100000).toFixed(2)}L · Available: <strong className="text-emerald-700">₹{(poAvailable / 100000).toFixed(2)}L</strong></div>
                    {linkedPOHasPendingEdit && (
                      <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                        <Edit3 className="w-3 h-3 inline mr-1" /><strong>Edit Pending:</strong> An edit request is in approval. PO amount may change once approved. Payment is still allowed against current amount.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isProject && selectedType && deptPOs.length > 0 && (
          <div className="rounded-lg p-3 border bg-fuchsia-50 border-fuchsia-200">
            <label className="block text-xs font-bold text-fuchsia-900 mb-1.5">
              <FileSignature className="w-3.5 h-3.5 inline mr-1" />Link to PO (optional)
            </label>
            <select value={form.linkedPOId} onChange={(e) => setForm({ ...form, linkedPOId: e.target.value })} className="w-full px-3 py-2 border border-fuchsia-300 rounded-lg text-sm bg-white">
              <option value="">No PO (small payment via Monthly Budget pool)</option>
              {deptPOs.map(po => {
                const avail = getPOAvailable(po, requests);
                const editing = hasPendingEdit(po.id) ? " ⚠ edit pending" : "";
                return <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(avail / 100000).toFixed(2)}L avail){editing}</option>;
              })}
            </select>
            {linkedPO && (
              <div className="mt-2 text-xs text-fuchsia-800 bg-white rounded p-2 border border-fuchsia-200">
                <div className="font-semibold">{linkedPO.poNumber} · {linkedPO.supplierName}</div>
                <div>Approved: ₹{(linkedPO.amountINR / 100000).toFixed(2)}L · Available: <strong className="text-emerald-700">₹{(poAvailable / 100000).toFixed(2)}L</strong></div>
                <div className="mt-1 italic">Note: Will deduct from BOTH this PO and Monthly Budget pool.</div>
                {linkedPOHasPendingEdit && (
                  <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                    <Edit3 className="w-3 h-3 inline mr-1" /><strong>Edit Pending</strong> — amount may change.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isProject && selectedType && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purpose *</label>
              <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Quarterly team offsite" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            {monthlyBudget ? (
              <div className={`rounded-lg p-3 border ${amountINR > monthlyAvailable ? "bg-red-50 border-red-200" : monthlyUsage.total / monthlyBudget.amountINR > 0.8 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="w-4 h-4 text-slate-700" />
                  <div className="text-xs font-bold text-slate-900">📊 {user.dept} Monthly Pool — {selectedType.name}</div>
                </div>
                <div className="text-xs text-slate-700 mb-1">Approved by <strong>{monthlyBudget.approvedBy || monthlyBudget.requesterName}</strong> · Available to all {user.dept} members</div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(monthlyBudget.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Used</div><div className="font-bold">₹{(monthlyUsage.total / 1000).toFixed(1)}K</div></div>
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Available</div><div className="font-bold text-emerald-700">₹{(monthlyAvailable / 1000).toFixed(1)}K</div></div>
                </div>
                {amountINR > monthlyAvailable && <div className="text-xs text-red-700 font-semibold">⚠ Exceeds available budget. Ask Dept Head for an Extension.</div>}
              </div>
            ) : (
              <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900">No Monthly Budget Pool for this category</div>
                    <div className="text-amber-800 mt-0.5">{user.dept} doesn't have an active Monthly Budget for <strong>{selectedType.name}</strong> in {currentMonth}. Ask your Dept Head to raise one.</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {isTravel && (
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">From</label><input value={form.travelFrom} onChange={(e) => setForm({ ...form, travelFrom: e.target.value })} placeholder="Delhi" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">To</label><input value={form.travelTo} onChange={(e) => setForm({ ...form, travelTo: e.target.value })} placeholder="Bangalore" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Dates</label><input value={form.travelDates} onChange={(e) => setForm({ ...form, travelDates: e.target.value })} placeholder="15-18 May 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vendor / Payee</label>
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          {isVendorPayment && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Invoice Number</label>
              <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-2026-001" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description *</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this expense for?" rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>

        <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Amount" required />

        {isMultiApprover && !isOdmProject && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <label className="block text-xs font-semibold text-indigo-900 mb-2">Select Approver *</label>
            <div className="space-y-1.5">
              {eligibleApprovers.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer bg-white rounded px-3 py-2 border border-indigo-200 hover:bg-indigo-50">
                  <input type="radio" checked={form.selectedApproverIds.includes(a.id)} onChange={() => setForm({ ...form, selectedApproverIds: [a.id] })} className="w-4 h-4" />
                  <div><div className="text-sm font-semibold text-slate-900">{a.name}</div><div className="text-xs text-slate-500">{a.designation}</div></div>
                </label>
              ))}
            </div>
          </div>
        )}
        {isOdmProject && <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs font-semibold text-indigo-900">ODM Project requests need approval from BOTH Shreya and Akash.</div>}

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required />

        {amountINR > 0 && form.expenseTypeId && <FlowPreview steps={flowSteps} />}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : (resubmitFrom ? "Resubmit" : "Submit Payment Request")}</button>
        </div>
      </div>
    </div>
  );
}

// ============ NEW BUDGET FORM ============
function NewBudgetRequestForm({ user, budgets, requests, saveBudgets, onSuccess }) {
  const initialBudgetType = NON_PROJECT_DEPTS.includes(user.dept) ? "Monthly" : "Project";
  const [budgetType, setBudgetType] = useState(initialBudgetType);
  const [projectType, setProjectType] = useState(null);
  const [form, setForm] = useState({
    projectId: "", projectName: "", client: "", startDate: "", endDate: "",
    clientOrderValue: "", clientOrderCurrency: "INR", clientOrderFxRate: 1,
    amount: "", currency: "INR", fxRate: 1,
    category: "", month: new Date().toISOString().slice(0, 7),
    extensionFor: "", reason: "", scope: "", attachment: null,
    rdType: "", justification: "", expectedOutcome: "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountINR = form.currency === "INR" ? parseFloat(form.amount || 0) : parseFloat(form.amount || 0) * parseFloat(form.fxRate || 0);
  const clientOrderINR = form.clientOrderCurrency === "INR" ? parseFloat(form.clientOrderValue || 0) : parseFloat(form.clientOrderValue || 0) * parseFloat(form.clientOrderFxRate || 0);
  const maxAllowedBudget = clientOrderINR * MAX_BUDGET_RATIO;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const rdThisMonth = budgets.filter(b => b.type === "Project" && b.projectType === "RD" && (b.status === "Active" || b.currentStage === "Active") && (b.approvedDate?.slice(0, 7) === currentMonth || b.createdDate?.slice(0, 7) === currentMonth));
  const rdUsedThisMonth = rdThisMonth.reduce((s, b) => s + b.amountINR, 0);
  const rdAvailableThisMonth = Math.max(0, RD_MONTHLY_CAP - rdUsedThisMonth);

  const canRaiseProject = !NON_PROJECT_DEPTS.includes(user.dept) && (user.role === "Employee" || isHODLevel(user) || user.role === "DeptApprover");
  const canRaiseMonthly = isHODLevel(user);
  const canRaiseExtension = isHODLevel(user);
  const canRaiseRD = user.dept === "ODM" && (user.role === "Employee" || isHODLevel(user));

  const eligibleApprovers = getEligibleDeptApprovers(user, { requiresProject: true, category: "Project" }, true);
  const needsMid = needsBoxBuildMidApproval(user);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); setErr(""); };
    reader.readAsDataURL(file);
  }

  function resetProjectType() { setProjectType(null); setForm({ ...form, projectId: "", projectName: "", client: "", clientOrderValue: "", amount: "", rdType: "", justification: "", expectedOutcome: "", scope: "" }); }

  async function submit() {
    setErr("");
    if (!form.amount || amountINR <= 0) return setErr("Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");

    if (budgetType === "Project") {
      if (!projectType) return setErr("Select Client or R&D");
      if (!form.projectId.trim()) return setErr("Project ID required");
      if (!form.projectName.trim()) return setErr("Project Name required");
      if (budgets.find(b => b.type === "Project" && b.projectId === form.projectId && !["Rejected", "Cancelled"].includes(b.status))) return setErr("Budget already exists for this Project ID. Raise an Extension.");

      if (projectType === "Client") {
        if (!form.client.trim()) return setErr("Client name required");
        if (!form.clientOrderValue || clientOrderINR <= 0) return setErr("Client Order Value required");
        if (!form.scope.trim()) return setErr("Scope required");
        if (amountINR > maxAllowedBudget) return setErr(`Budget cannot exceed 80% of Client Order (max ₹${(maxAllowedBudget / 100000).toFixed(2)}L).`);
      } else if (projectType === "RD") {
        if (!canRaiseRD) return setErr("Only ODM can raise R&D budgets.");
        if (!form.rdType) return setErr("R&D Type required");
        if (!form.justification.trim()) return setErr("Justification required");
        if (!form.expectedOutcome.trim()) return setErr("Expected Outcome required");
        if (amountINR > rdAvailableThisMonth) return setErr(`Exceeds monthly R&D cap. Available: ₹${(rdAvailableThisMonth / 1000).toFixed(1)}K. Use Extension instead.`);
      }
    } else if (budgetType === "Monthly") {
      if (!form.category) return setErr("Category required");
      if (!form.month) return setErr("Month required");
    } else if (budgetType === "Extension") {
      if (!form.extensionFor) return setErr("Select project to extend");
      if (!form.reason.trim()) return setErr("Reason required");
      const existing = budgets.find(b => b.projectId === form.extensionFor && b.type === "Project");
      if (existing && existing.projectType === "Client") {
        const exts = budgets.filter(b => b.type === "Extension" && b.extensionFor === form.extensionFor && (b.status === "Active" || b.currentStage === "Active"));
        const extTotal = exts.reduce((s, e) => s + e.amountINR, 0);
        const max = existing.clientOrderValue * MAX_BUDGET_RATIO;
        if (existing.amountINR + extTotal + amountINR > max) return setErr(`Extension exceeds 80% cap. Max: ₹${(max / 100000).toFixed(2)}L.`);
      }
    }

    if (!form.attachment) return setErr("Attachment mandatory");

    setSubmitting(true);
    const now = new Date().toISOString();
    const selectedApproverIds = eligibleApprovers.map(a => a.id);
    const initialStage = needsMid && user.dept === "Box Build" && user.role === "Employee" ? "BoxBuildMid" : "DeptApproval";

    const newBudget = {
      id: "BUD-" + Date.now(), kind: "Budget", type: budgetType, projectType: budgetType === "Project" ? projectType : undefined,
      createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
      projectId: form.projectId, projectName: form.projectName, client: form.client,
      startDate: form.startDate, endDate: form.endDate,
      clientOrderValue: projectType === "Client" ? clientOrderINR : 0,
      clientOrderValueCurrency: form.clientOrderCurrency, clientOrderValueFxRate: parseFloat(form.clientOrderFxRate),
      amount: parseFloat(form.amount), currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR,
      category: form.category, month: form.month,
      extensionFor: form.extensionFor, reason: form.reason, scope: form.scope, attachment: form.attachment,
      rdType: form.rdType, justification: form.justification, expectedOutcome: form.expectedOutcome,
      selectedApprovers: selectedApproverIds, currentStage: initialStage, status: getStageLabel(initialStage, "Budget"),
      history: [{ action: "Submitted", by: user.name, byId: user.id, at: now, comments: `${budgetType} budget request raised` }],
    };
    await saveBudgets([newBudget, ...budgets]);
    setSubmitting(false);
    onSuccess();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-900">Raise Budget Request</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">Budgets must be approved before payment requests can be raised.</p>

      <div className={`grid gap-2 mb-5 ${canRaiseProject ? "grid-cols-3" : "grid-cols-2"}`}>
        {canRaiseProject && (
          <button onClick={() => { setBudgetType("Project"); resetProjectType(); }} className={`px-3 py-3 rounded-lg text-sm font-semibold border ${budgetType === "Project" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700 hover:border-indigo-400"}`}>
            <Briefcase className="w-4 h-4 inline mr-1" />Project Budget
          </button>
        )}
        <button onClick={() => { setBudgetType("Monthly"); resetProjectType(); }} disabled={!canRaiseMonthly} className={`px-3 py-3 rounded-lg text-sm font-semibold border ${budgetType === "Monthly" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"} ${!canRaiseMonthly ? "opacity-40 cursor-not-allowed" : "hover:border-indigo-400"}`}>
          <Target className="w-4 h-4 inline mr-1" />Monthly
        </button>
        <button onClick={() => { setBudgetType("Extension"); resetProjectType(); }} disabled={!canRaiseExtension} className={`px-3 py-3 rounded-lg text-sm font-semibold border ${budgetType === "Extension" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"} ${!canRaiseExtension ? "opacity-40 cursor-not-allowed" : "hover:border-indigo-400"}`}>
          <TrendingUp className="w-4 h-4 inline mr-1" />Extension
        </button>
      </div>

      {NON_PROJECT_DEPTS.includes(user.dept) && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          <strong>{user.dept}</strong> can raise Monthly Budgets and Extensions only.
        </div>
      )}
      {!canRaiseMonthly && budgetType === "Monthly" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">Only Department Heads can raise Monthly Budgets.</div>}
      {!canRaiseExtension && budgetType === "Extension" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">Only Department Heads can raise Extensions.</div>}

      {budgetType === "Project" && canRaiseProject && !projectType && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">Project type?</div>
          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={() => setProjectType("Client")} className="text-left bg-white border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Briefcase className="w-5 h-5" /></div><div className="font-bold">Client Project</div></div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>✓ Order received from client</div>
                <div>✓ Budget ≤ 80% of order value</div>
                <div>✓ 20% margin enforced</div>
              </div>
            </button>
            <button onClick={() => canRaiseRD ? setProjectType("RD") : setErr("Only ODM can raise R&D")} disabled={!canRaiseRD} className={`text-left bg-white border-2 rounded-xl p-5 ${canRaiseRD ? "border-slate-200 hover:border-fuchsia-400 hover:bg-fuchsia-50" : "border-slate-100 opacity-50 cursor-not-allowed"}`}>
              <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg flex items-center justify-center"><Target className="w-5 h-5" /></div><div className="font-bold">Internal / R&D</div></div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>✓ ODM only</div>
                <div>✓ Monthly cap: ₹{(RD_MONTHLY_CAP / 100000).toFixed(1)}L (avail: ₹{(rdAvailableThisMonth / 1000).toFixed(1)}K)</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {budgetType === "Project" && projectType && (
        <button onClick={resetProjectType} className="mb-4 text-xs text-blue-600 hover:text-blue-700 font-medium">← Change project type</button>
      )}

      <div className="space-y-4">
        {budgetType === "Project" && projectType === "Client" && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project ID *</label><input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="EB-XX-XX-XXX-XX-XXXX" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Name *</label><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Client *</label><input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Start</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">End</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2"><Coins className="w-4 h-4 text-amber-700" /><span className="text-sm font-bold text-amber-900">Client Order Value (excl. GST)</span></div>
              <CurrencyInput value={form.clientOrderValue} currency={form.clientOrderCurrency} fxRate={form.clientOrderFxRate} onChange={(v) => setForm({ ...form, clientOrderValue: v.amount, clientOrderCurrency: v.currency, clientOrderFxRate: v.fxRate })} label="Billed value (excl. GST)" required />
              {clientOrderINR > 0 && <div className="mt-3 bg-white rounded p-2 text-xs"><div className="text-amber-900 font-semibold">📊 Max Budget: ₹{(maxAllowedBudget / 100000).toFixed(2)}L (80%)</div></div>}
            </div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Scope *</label><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Total Budget" required />
            {amountINR > 0 && clientOrderINR > 0 && (
              <div className={`rounded-lg p-3 text-sm ${amountINR > maxAllowedBudget ? "bg-red-50 border border-red-200 text-red-900" : "bg-emerald-50 border border-emerald-200 text-emerald-900"}`}>
                {amountINR > maxAllowedBudget ? <><AlertTriangle className="w-4 h-4 inline mr-1" /><strong>BLOCKED:</strong> exceeds 80% cap.</> : <><CheckCircle2 className="w-4 h-4 inline mr-1" /><strong>OK:</strong> Margin {(((clientOrderINR - amountINR) / clientOrderINR) * 100).toFixed(1)}%</>}
              </div>
            )}
          </>
        )}

        {budgetType === "Project" && projectType === "RD" && (
          <>
            <div className={`rounded-lg p-3 border ${rdUsedThisMonth >= RD_MONTHLY_CAP ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="flex justify-between text-xs font-semibold"><span>R&D Cap ({currentMonth})</span><span>₹{(rdUsedThisMonth / 1000).toFixed(1)}K / ₹{(RD_MONTHLY_CAP / 1000).toFixed(0)}K</span></div>
              <div className="text-xs">Available: <strong>₹{(rdAvailableThisMonth / 1000).toFixed(1)}K</strong></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project ID *</label><input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Name *</label><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">R&D Type *</label>
              <select value={form.rdType} onChange={(e) => setForm({ ...form, rdType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select</option><option>Internal Product Development</option><option>Sample Development</option><option>Pure R&D</option><option>Prototype</option>
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Justification *</label><textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Expected Outcome *</label><textarea value={form.expectedOutcome} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="R&D Budget" required />
          </>
        )}

        {budgetType === "Monthly" && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label><input value={user.dept} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Month *</label><input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select</option>
                {EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Monthly Amount" required />
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Justification *</label><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </>
        )}

        {budgetType === "Extension" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Extend which Project? *</label>
              <select value={form.extensionFor} onChange={(e) => setForm({ ...form, extensionFor: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select</option>
                {budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active")).map(b => <option key={b.projectId} value={b.projectId}>[{b.projectType === "RD" ? "R&D" : "Client"}] {b.projectId} — {b.projectName}</option>)}
              </select>
            </div>
            <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Extension Amount" required />
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason *</label><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </>
        )}

        {(budgetType !== "Project" || projectType) && (
          <>
            <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required label="Supporting Document" />
            {amountINR > 0 && <FlowPreview steps={[user.name, "Dept Head", amountINR >= VP_THRESHOLD && amountINR < CEO_THRESHOLD ? "VP" : null, amountINR >= CEO_THRESHOLD ? "VP + CEO" : null, "Finance Head", "Active"].filter(Boolean)} />}
            {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : `Submit ${budgetType} Budget`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============ NEW PO REQUEST FORM ============
function NewPORequestForm({ user, budgets, pos, requests, savePOs, onSuccess, editFor = null }) {
  const isEdit = !!editFor;
  const [form, setForm] = useState(isEdit ? {
    poNumber: "",
    isProject: editFor.isProject,
    projectId: editFor.projectId || "",
    category: editFor.category || "",
    supplierName: editFor.supplierName,
    supplierAddress: editFor.supplierAddress,
    supplierGST: editFor.supplierGST || "",
    isInternational: editFor.isInternational || false,
    supplierCountry: editFor.supplierCountry || "",
    supplierTaxId: editFor.supplierTaxId || "",
    lineItems: editFor.lineItems && editFor.lineItems.length > 0 ? JSON.parse(JSON.stringify(editFor.lineItems)) : [{ id: "L1", description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }],
    currency: editFor.currency || "INR",
    fxRate: editFor.fxRate || 1,
    scope: editFor.scope,
    deliveryTimeline: editFor.deliveryTimeline,
    paymentTerms: editFor.paymentTerms,
    attachment: null,
    editReason: "",
    changeNote: "",
    verified: false,
  } : {
    isProject: !NON_PROJECT_DEPTS.includes(user.dept),
    projectId: "", category: "",
    supplierName: "", supplierAddress: "", supplierGST: "",
    isInternational: false, supplierCountry: "", supplierTaxId: "",
    lineItems: [{ id: "L1", description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }],
    currency: "INR", fxRate: 1,
    scope: "", deliveryTimeline: "", paymentTerms: "Net 30",
    attachment: null,
    verified: false,
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totals = computeLineItemTotals(form.lineItems);
  const grandTotalINR = form.currency === "INR" ? totals.grandTotal : totals.grandTotal * parseFloat(form.fxRate || 0);
  const subtotalINR = form.currency === "INR" ? totals.subtotal : totals.subtotal * parseFloat(form.fxRate || 0);
  const gstINR = form.currency === "INR" ? totals.totalGST : totals.totalGST * parseFloat(form.fxRate || 0);

  const activeBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));
  const eligibleApprovers = getEligibleDeptApprovers(user, { requiresProject: form.isProject, category: form.isProject ? "Project" : "Non-Project" }, form.isProject);
  const needsMid = needsBoxBuildMidApproval(user);
  const canRaiseProjectPO = !NON_PROJECT_DEPTS.includes(user.dept);

  function addLineItem() {
    const newId = "L" + (form.lineItems.length + 1) + "-" + Date.now().toString(36);
    setForm({ ...form, lineItems: [...form.lineItems, { id: newId, description: "", qty: "", unit: "pcs", unitCost: "", gstPct: 18 }] });
  }
  function removeLineItem(id) {
    if (form.lineItems.length === 1) { setErr("At least 1 line item required"); return; }
    setForm({ ...form, lineItems: form.lineItems.filter(li => li.id !== id), verified: false });
  }
  function updateLineItem(id, field, value) {
    setForm({ ...form, lineItems: form.lineItems.map(li => li.id === id ? { ...li, [field]: value } : li), verified: false });
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm({ ...form, attachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); setErr(""); };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (form.isProject && !form.projectId) return setErr("Select project");
    if (!form.isProject && !form.category) return setErr("Select category");
    if (!form.supplierName.trim()) return setErr("Supplier name required");
    if (!form.supplierAddress.trim()) return setErr("Supplier address required");

    // GSTIN validation
    if (!form.isInternational) {
      if (!form.supplierGST.trim()) return setErr("GSTIN required for Indian suppliers (or check 'International supplier' if not applicable)");
      if (!GSTIN_REGEX.test(form.supplierGST.trim().toUpperCase())) return setErr("Invalid GSTIN format. Expected 15 chars like 09AABCA1234A1ZP");
    } else {
      if (!form.supplierCountry.trim()) return setErr("Country required for international supplier");
    }

    // Line items validation
    if (!form.lineItems || form.lineItems.length === 0) return setErr("At least 1 line item required");
    for (let i = 0; i < form.lineItems.length; i++) {
      const li = form.lineItems[i];
      if (!li.description.trim()) return setErr(`Line ${i + 1}: description required`);
      if (!li.qty || parseFloat(li.qty) <= 0) return setErr(`Line ${i + 1}: qty must be > 0`);
      if (!li.unitCost || parseFloat(li.unitCost) <= 0) return setErr(`Line ${i + 1}: unit cost must be > 0`);
    }

    if (totals.grandTotal <= 0) return setErr("Grand total must be > 0");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");

    if (!form.scope.trim()) return setErr("Scope required");
    if (!form.deliveryTimeline.trim()) return setErr("Delivery timeline required");
    if (!form.paymentTerms.trim()) return setErr("Payment terms required");

    if (!form.verified) return setErr("Please verify the totals are correct (checkbox below)");

    if (isEdit) {
      if (!form.poNumber.trim()) return setErr("PO number reference required");
      if (form.poNumber !== editFor.poNumber) return setErr(`PO number must match: ${editFor.poNumber}`);
      if (!form.editReason.trim()) return setErr("Reason for edit required");
      if (!form.changeNote.trim()) return setErr("What's changing — required");

      // Re-validate against project budget if amount increases
      if (form.isProject && form.projectId && grandTotalINR > editFor.amountINR) {
        const budget = getActiveBudgetForProject(budgets, form.projectId);
        if (budget) {
          const otherProjectPOs = pos.filter(p => p.type === "POCreate" && p.projectId === form.projectId && p.id !== editFor.id && (p.status === "Approved" || p.currentStage === "Approved" || p.status === "Closed"));
          const otherPOAmount = otherProjectPOs.reduce((s, p) => s + p.amountINR, 0);
          const totalAfter = otherPOAmount + grandTotalINR;
          if (totalAfter > budget.amountINR) {
            const overBy = totalAfter - budget.amountINR;
            return setErr(`Edit pushes total POs to ₹${(totalAfter / 100000).toFixed(2)}L, exceeding budget of ₹${(budget.amountINR / 100000).toFixed(2)}L by ₹${(overBy / 100000).toFixed(2)}L. Raise a Budget Extension first.`);
          }
          if (budget.projectType === "Client" && budget.clientOrderValue > 0) {
            const ceiling = budget.clientOrderValue * MAX_BUDGET_RATIO;
            if (totalAfter > ceiling) return setErr(`Breaches 20% margin. Max PO commitments: ₹${(ceiling / 100000).toFixed(2)}L (80% of client order ₹${(budget.clientOrderValue / 100000).toFixed(2)}L).`);
          }
        }
      }
    }

    if (form.isProject && !isEdit) {
      const budget = getActiveBudgetForProject(budgets, form.projectId);
      if (!budget) return setErr("Selected project has no active budget.");
    }
    if (!form.attachment && !isEdit) return setErr("Vendor quote mandatory");

    setSubmitting(true);
    const now = new Date().toISOString();
    const selectedApproverIds = eligibleApprovers.map(a => a.id);

    const baseData = {
      isProject: form.isProject, projectId: form.projectId, category: form.category,
      supplierName: form.supplierName, supplierAddress: form.supplierAddress,
      supplierGST: form.supplierGST.trim().toUpperCase(),
      isInternational: form.isInternational, supplierCountry: form.supplierCountry, supplierTaxId: form.supplierTaxId,
      lineItems: JSON.parse(JSON.stringify(form.lineItems)),
      subtotal: totals.subtotal, totalGST: totals.totalGST,
      amount: totals.grandTotal, currency: form.currency, fxRate: parseFloat(form.fxRate), amountINR: grandTotalINR,
      scope: form.scope, deliveryTimeline: form.deliveryTimeline, paymentTerms: form.paymentTerms,
      attachment: form.attachment,
    };

    if (isEdit) {
      const editRequest = {
        id: "POEDIT-" + Date.now(), kind: "PO", type: "POEdit",
        editingPOId: editFor.id, editingPONumber: editFor.poNumber,
        createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
        ...baseData,
        editReason: form.editReason, changeNote: form.changeNote,
        currentStage: needsMid && user.dept === "Box Build" && user.role === "Employee" ? "BoxBuildMid" : "DeptApproval",
        status: getStageLabel("DeptApproval", "PO"),
        selectedApprovers: selectedApproverIds,
        history: [{ action: "Edit Submitted", by: user.name, byId: user.id, at: now, comments: `Edit for ${editFor.poNumber}: ${form.changeNote}` }],
      };
      await savePOs([editRequest, ...pos]);
    } else {
      const initialStage = needsMid ? "BoxBuildMid" : "DeptApproval";
      const newPO = {
        id: "PO-REQ-" + Date.now(), kind: "PO", type: "POCreate",
        createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
        ...baseData,
        currentStage: initialStage, status: getStageLabel(initialStage, "PO"),
        selectedApprovers: selectedApproverIds, version: 1, editHistory: [],
        history: [{ action: "Submitted", by: user.name, byId: user.id, at: now, comments: "PO request raised" }],
      };
      await savePOs([newPO, ...pos]);
    }
    setSubmitting(false);
    onSuccess();
  }

  const flowSteps = [user.name];
  if (needsMid) flowSteps.push("Arun (Delivery Head)");
  flowSteps.push(eligibleApprovers.map(a => a.name).filter(Boolean).join(" / ") || "Dept Head");
  if (!isEdit) {
    if (grandTotalINR >= VP_THRESHOLD && grandTotalINR < CEO_THRESHOLD) flowSteps.push("VP");
    if (grandTotalINR >= CEO_THRESHOLD) flowSteps.push("VP + Stuti & Sarthak");
  }
  flowSteps.push("Finance Head");
  flowSteps.push("Accountant (assigns PO #)");

  const currencySymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol || "₹";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
      {isEdit && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Edit3 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Editing PO {editFor.poNumber} (v{editFor.version || 1})</div>
            <div className="text-xs text-amber-800 mt-0.5">Approval: Dept Head → Finance Head → Accountant. New version will be created.</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <FileSignature className="w-5 h-5 text-fuchsia-600" />
        <h2 className="text-xl font-bold text-slate-900">{isEdit ? "Edit PO Request" : "Raise PO Request"}</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">{isEdit ? "Edit existing PO. PO amount auto-calculated from line items." : "PO is raised for one supplier. Amount auto-calculated from line items."}</p>

      <div className="space-y-4">
        {isEdit && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">PO Number Reference *</label>
            <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} placeholder={`Type ${editFor.poNumber}`} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
          </div>
        )}

        {!isEdit && canRaiseProjectPO && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setForm({ ...form, isProject: true, category: "" })} className={`px-3 py-2.5 rounded-lg text-sm font-semibold border ${form.isProject ? "bg-fuchsia-600 text-white border-fuchsia-600" : "bg-white border-slate-200 text-slate-700"}`}><Briefcase className="w-4 h-4 inline mr-1" />For Project</button>
            <button onClick={() => setForm({ ...form, isProject: false, projectId: "" })} className={`px-3 py-2.5 rounded-lg text-sm font-semibold border ${!form.isProject ? "bg-fuchsia-600 text-white border-fuchsia-600" : "bg-white border-slate-200 text-slate-700"}`}><Target className="w-4 h-4 inline mr-1" />Department (Non-Project)</button>
          </div>
        )}
        {!isEdit && !canRaiseProjectPO && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900"><strong>{user.dept}</strong> can only raise non-project POs.</div>
        )}

        {form.isProject && !isEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project *</label>
            {activeBudgets.length === 0 ? (
              <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900"><AlertTriangle className="w-4 h-4 inline mr-1" />No active project budgets.</div>
            ) : (
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select project</option>
                {activeBudgets.map(b => <option key={b.projectId} value={b.projectId}>[{b.projectType === "RD" ? "R&D" : "Client"}] {b.projectId} — {b.projectName}</option>)}
              </select>
            )}
          </div>
        )}

        {!form.isProject && !isEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select</option>
              {EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Supplier Details */}
        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs font-bold text-fuchsia-900"><Briefcase className="w-3.5 h-3.5 inline mr-1" />Supplier Details</div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-900 cursor-pointer">
              <input type="checkbox" checked={form.isInternational} onChange={(e) => setForm({ ...form, isInternational: e.target.checked, supplierGST: e.target.checked ? "" : form.supplierGST })} className="w-3.5 h-3.5" />
              International supplier (no GSTIN)
            </label>
          </div>
          <div className="space-y-2">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label><input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label><textarea value={form.supplierAddress} onChange={(e) => setForm({ ...form, supplierAddress: e.target.value })} rows={2} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" /></div>
            {!form.isInternational ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN * <span className="font-normal text-slate-500">(15 chars, e.g. 09AABCA1234A1ZP)</span></label>
                <input value={form.supplierGST} onChange={(e) => setForm({ ...form, supplierGST: e.target.value.toUpperCase() })} placeholder="09AABCA1234A1ZP" className={`w-full px-3 py-1.5 border rounded-lg text-sm font-mono ${form.supplierGST && !GSTIN_REGEX.test(form.supplierGST.trim()) ? "border-red-300 bg-red-50" : "border-slate-300"}`} maxLength={15} />
                {form.supplierGST && !GSTIN_REGEX.test(form.supplierGST.trim()) && <p className="text-xs text-red-600 mt-1">Invalid GSTIN format</p>}
                {form.supplierGST && GSTIN_REGEX.test(form.supplierGST.trim()) && <p className="text-xs text-emerald-600 mt-1"><CheckCircle2 className="w-3 h-3 inline" /> Valid GSTIN</p>}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-2">
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Country *</label><input value={form.supplierCountry} onChange={(e) => setForm({ ...form, supplierCountry: e.target.value })} placeholder="e.g. USA, Singapore" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Tax ID / VAT (optional)</label><input value={form.supplierTaxId} onChange={(e) => setForm({ ...form, supplierTaxId: e.target.value })} placeholder="EIN / VAT / TIN" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono" /></div>
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs font-bold text-purple-900">📋 Line Items *</div>
            <div className="flex items-center gap-2">
              <select value={form.currency} onChange={(e) => {
                const newCurr = e.target.value;
                const newRate = CURRENCIES.find(c => c.code === newCurr)?.defaultRate || 1;
                setForm({ ...form, currency: newCurr, fxRate: newCurr === "INR" ? 1 : newRate, verified: false });
              }} className="text-xs px-2 py-1 border border-purple-300 rounded-lg">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button onClick={addLineItem} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"><Plus className="w-3 h-3" />Add Line</button>
            </div>
          </div>
          {form.currency !== "INR" && (
            <div className="mb-2 grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-slate-600 mb-0.5">FX Rate (1 {form.currency} = ? INR)</label><input type="number" step="0.01" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value, verified: false })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" /></div>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5 text-xs"><span className="text-emerald-700">Grand Total in INR:</span> <strong className="text-emerald-900">₹{grandTotalINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-600 font-semibold border-b border-purple-200">
                  <th className="p-1 w-8">#</th>
                  <th className="p-1">Description *</th>
                  <th className="p-1 w-16">Qty *</th>
                  <th className="p-1 w-20">Unit</th>
                  <th className="p-1 w-24">Unit Cost *</th>
                  <th className="p-1 w-16">GST %</th>
                  <th className="p-1 w-24 text-right">Line Total</th>
                  <th className="p-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.lineItems.map((li, idx) => {
                  const lineSubtotal = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                  const lineGST = lineSubtotal * (parseFloat(li.gstPct || 0) / 100);
                  const lineTotal = lineSubtotal + lineGST;
                  return (
                    <tr key={li.id} className="border-b border-purple-100 last:border-0">
                      <td className="p-1 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-1"><input value={li.description} onChange={(e) => updateLineItem(li.id, "description", e.target.value)} placeholder="Item description" className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs" /></td>
                      <td className="p-1"><input type="number" value={li.qty} onChange={(e) => updateLineItem(li.id, "qty", e.target.value)} className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs" /></td>
                      <td className="p-1">
                        <select value={li.unit} onChange={(e) => updateLineItem(li.id, "unit", e.target.value)} className="w-full px-1 py-1 border border-slate-300 rounded text-xs">
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="p-1"><input type="number" value={li.unitCost} onChange={(e) => updateLineItem(li.id, "unitCost", e.target.value)} placeholder={currencySymbol} className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs" /></td>
                      <td className="p-1">
                        <select value={li.gstPct} onChange={(e) => updateLineItem(li.id, "gstPct", parseFloat(e.target.value))} className="w-full px-1 py-1 border border-slate-300 rounded text-xs">
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="p-1 text-right font-semibold text-slate-900">{currencySymbol}{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="p-1 text-center">
                        {form.lineItems.length > 1 && <button onClick={() => removeLineItem(li.id)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X className="w-3 h-3" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-purple-300">
                  <td colSpan={6} className="p-1.5 text-right font-semibold text-slate-700">Subtotal (excl GST):</td>
                  <td className="p-1.5 text-right font-bold text-slate-900">{currencySymbol}{totals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="p-1.5 text-right font-semibold text-slate-700">Total GST:</td>
                  <td className="p-1.5 text-right font-bold text-slate-900">{currencySymbol}{totals.totalGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                <tr className="bg-purple-100">
                  <td colSpan={6} className="p-1.5 text-right font-bold text-purple-900">GRAND TOTAL (incl GST):</td>
                  <td className="p-1.5 text-right font-bold text-purple-900 text-sm">{currencySymbol}{totals.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Scope Summary *</label><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={2} placeholder="Brief overall scope (separate from line items)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Delivery *</label><input value={form.deliveryTimeline} onChange={(e) => setForm({ ...form, deliveryTimeline: e.target.value })} placeholder="e.g. 4 weeks" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Terms *</label>
            <select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option>Advance 100%</option><option>Advance 50% / Balance on Delivery</option><option>Advance 30% / Balance on Delivery</option><option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>On Delivery</option><option>Custom</option>
            </select>
          </div>
        </div>

        {isEdit && (
          <>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for Edit *</label><input value={form.editReason} onChange={(e) => setForm({ ...form, editReason: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">What's Changing? *</label><textarea value={form.changeNote} onChange={(e) => setForm({ ...form, changeNote: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
          </>
        )}

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required={!isEdit} label={isEdit ? "Updated Quote (optional)" : "Vendor Quote / Supporting Doc"} />

        {/* Verify Total checkbox */}
        {totals.grandTotal > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <div className="text-sm font-bold text-amber-900 mb-2">⚠ Please verify the totals before submitting</div>
            <div className="text-xs text-amber-800 mb-3 space-y-0.5">
              <div>{form.lineItems.length} line item{form.lineItems.length !== 1 ? "s" : ""}</div>
              <div>Subtotal (excl GST): <strong>{currencySymbol}{totals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
              <div>+ GST: <strong>{currencySymbol}{totals.totalGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
              <div className="text-base pt-1 border-t border-amber-300 mt-1">= <strong>Grand Total: {currencySymbol}{totals.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>{form.currency !== "INR" && ` (≈ ₹${grandTotalINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })})`}</div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="w-4 h-4 mt-0.5" />
              <span className="text-xs font-semibold text-amber-900">I have verified all line items, quantities, unit costs, and GST rates are correct.</span>
            </label>
          </div>
        )}

        {grandTotalINR > 0 && <FlowPreview steps={flowSteps} />}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting || !form.verified} className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : (isEdit ? "Submit Edit Request" : "Submit PO Request")}</button>
        </div>
      </div>
    </div>
  );
}

function AttachmentInput({ form, setForm, handleFileUpload, required = false, label = "Attachment (Invoice / Quote / Receipt)" }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      {!form.attachment ? (
        <label className="flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50">
          <Upload className="w-6 h-6 text-slate-400 mb-2" />
          <span className="text-sm font-medium text-slate-700">Click to upload</span>
          <span className="text-xs text-slate-500 mt-1">PDF, PNG, JPG, DOC up to 2MB</span>
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileUpload} />
        </label>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Paperclip className="w-4 h-4 text-emerald-700" /><div className="text-sm"><div className="font-semibold text-emerald-900">{form.attachment.name}</div><div className="text-xs text-emerald-700">{(form.attachment.size / 1024).toFixed(1)} KB</div></div></div>
          <button onClick={() => setForm({ ...form, attachment: null })} className="text-red-600 hover:bg-red-100 p-1 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function AttachmentViewer({ attachment, onClose }) {
  if (!attachment) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2"><Paperclip className="w-5 h-5 text-slate-600" /><div><div className="font-semibold">{attachment.name}</div><div className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</div></div></div>
          <div className="flex gap-2">{attachment.data && <a href={attachment.data} download={attachment.name} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg">Download</a>}<button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button></div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {attachment.data ? (isImageFile(attachment.type) ? <img src={attachment.data} alt={attachment.name} className="max-w-full mx-auto rounded" /> : isPdfFile(attachment.type) ? <iframe src={attachment.data} className="w-full h-[70vh] rounded border border-slate-200" title={attachment.name} /> : <div className="text-center py-10"><FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" /><p className="text-slate-600 text-sm mb-3">Preview not available.</p><a href={attachment.data} download={attachment.name} className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">Download</a></div>) : <div className="text-center py-10"><FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" /><p className="text-slate-600 text-sm">File data not available.</p></div>}
        </div>
      </div>
    </div>
  );
}

function FlowPreview({ steps }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="text-xs font-bold text-blue-900 mb-2">📋 Approval Flow Preview</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`px-2 py-1 rounded border ${i === 0 ? "bg-white border-blue-300" : i === steps.length - 1 ? "bg-emerald-100 border-emerald-300 font-semibold" : "bg-white border-blue-200"}`}>{step}</span>
            {i < steps.length - 1 && <span className="text-blue-400">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ REQUEST LIST ============
function RequestList({ requests, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter, poCounter, emptyMessage, showActions, showCancelResubmit, addNotifications, showToast }) {
  const [expanded, setExpanded] = useState(null);
  const [resubmitTarget, setResubmitTarget] = useState(null);

  if (resubmitTarget) {
    return (
      <div>
        <button onClick={() => setResubmitTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back</button>
        <NewPaymentRequestForm user={user} requests={requests_all} budgets={budgets_all} pos={pos_all} saveRequests={saveRequests} onSuccess={() => setResubmitTarget(null)} resubmitFrom={resubmitTarget} />
      </div>
    );
  }

  if (requests.length === 0) return <div className="bg-white rounded-xl border border-slate-200 p-10 text-center"><FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 text-sm">{emptyMessage}</p></div>;

  return (
    <div className="space-y-2">
      {requests.map(r => <RequestCard key={r.id} request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} expanded={expanded === r.id} setExpanded={setExpanded} showActions={showActions} showCancelResubmit={showCancelResubmit} onResubmit={() => setResubmitTarget(r)} addNotifications={addNotifications} showToast={showToast} />)}
    </div>
  );
}

function RequestCard({ request: r, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter, poCounter, expanded, setExpanded, showActions, showCancelResubmit, onResubmit, addNotifications, showToast }) {
  const isBudget = r.kind === "Budget";
  const isPO = r.kind === "PO";

  const statusColor = {
    "Pending Delivery Head (Arun)": "cyan", "Pending Delivery Head": "cyan",
    "Pending Dept Approval": "blue", "Pending Dept Head": "blue",
    "Pending VP": "violet", "Pending CEO": "amber", "Pending Stuti + Sarthak": "fuchsia",
    "Pending Finance Head": "indigo",
    "Pending Accountant Processing": "teal", "Pending PO Number Assignment": "teal",
    "Processing Payment": "blue",
    "Paid": "emerald", "Active Budget": "emerald", "Active": "emerald", "Approved": "emerald",
    "Rejected": "red", "Cancelled": "slate", "Closed": "slate",
  }[r.status] || "slate";

  const canCancel = showCancelResubmit && r.requesterId === user.id && !["Paid", "Rejected", "Cancelled", "Active", "Approved", "Closed"].includes(r.status) && r.currentStage !== "Processing";
  const canResubmit = showCancelResubmit && r.requesterId === user.id && r.status === "Rejected" && r.kind === "Payment";

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isPO ? "border-fuchsia-200" : isBudget ? "border-indigo-200" : "border-slate-200"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isPO ? "bg-fuchsia-100 text-fuchsia-700" : isBudget ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"}`}>
                {isPO ? <><FileSignature className="w-3 h-3 inline mr-0.5" />PO {r.type === "POEdit" ? "Edit" : r.type === "POCancel" ? "Cancel" : ""}</> : isBudget ? <><PiggyBank className="w-3 h-3 inline mr-0.5" />{r.type} Budget</> : <><Wallet className="w-3 h-3 inline mr-0.5" />Payment</>}
              </span>
              {isPO && r.poNumber && <span className="font-mono text-xs font-bold text-fuchsia-900">{r.poNumber}</span>}
              {isPO && r.version > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">v{r.version}</span>}
              <span className="font-mono text-xs text-slate-500">{r.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold bg-${statusColor}-100 text-${statusColor}-700`}>{r.status}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{r.dept}</span>
              {!isBudget && !isPO && <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{r.expenseTypeName}</span>}
              {r.isProject && <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Project</span>}
              {r.linkedPONumber && <span className="text-xs px-2 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 font-mono">{r.linkedPONumber}</span>}
              {r.currency && r.currency !== "INR" && <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">{r.currency}</span>}
              {r.resubmittedFrom && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Resubmitted</span>}
              {r.attachment && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 flex items-center gap-0.5"><Paperclip className="w-3 h-3" /></span>}
            </div>
            <div className="font-semibold text-slate-900 text-sm">
              {isPO ? (r.type === "POEdit" ? `Edit: ${r.editingPONumber} — ${r.supplierName}` : r.type === "POCancel" ? `Cancel: ${r.cancellingPONumber}` : `${r.supplierName}`) :
               isBudget ? `${r.projectName || r.category || "Extension"} ${r.projectId ? `(${r.projectId})` : ""}` :
               r.description}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              By <strong>{r.requesterName}</strong> · {new Date(r.createdDate || r.approvedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {r.vendor && <> · {r.vendor}</>}
              {r.client && r.projectType !== "RD" && <> · Client: {r.client}</>}
              {isPO && r.isProject && <> · Project: {r.projectId}</>}
              {isPO && !r.isProject && r.category && <> · {r.category}</>}
            </div>
          </div>
          <div className="text-right">
            {r.currency && r.currency !== "INR" ? (
              <>
                <div className="text-sm font-semibold text-slate-700">{CURRENCIES.find(c => c.code === r.currency)?.symbol}{r.amount.toLocaleString("en-IN")}</div>
                <div className="text-lg font-bold text-slate-900">₹{r.amountINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-slate-500">@ ₹{r.fxRate}/{r.currency}</div>
              </>
            ) : (
              <div className="text-lg font-bold text-slate-900">₹{(r.amountINR || r.amount || 0).toLocaleString("en-IN")}</div>
            )}
            <button onClick={() => setExpanded(expanded ? null : r.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mt-0.5 ml-auto"><Eye className="w-3 h-3" />{expanded ? "Hide" : "View"}</button>
          </div>
        </div>

        {showActions && <ActionButtons request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} savePOCounter={savePOCounter} poCounter={poCounter} addNotifications={addNotifications} showToast={showToast} />}
        {canCancel && <CancelButton request={r} user={user} requests_all={requests_all} budgets_all={budgets_all} pos_all={pos_all} saveRequests={saveRequests} saveBudgets={saveBudgets} savePOs={savePOs} />}
        {canResubmit && <div className="mt-2"><button onClick={onResubmit} className="bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Resubmit with edits</button></div>}

        {expanded && <RequestDetails request={r} pos_all={pos_all} />}
      </div>
    </div>
  );
}

function RequestDetails({ request: r, pos_all }) {
  const [viewAttachment, setViewAttachment] = useState(null);
  const isBudget = r.kind === "Budget";
  const isPO = r.kind === "PO";
  const isPOEdit = isPO && r.type === "POEdit";
  const originalPO = isPOEdit && pos_all ? pos_all.find(p => p.id === r.editingPOId) : null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {viewAttachment && <AttachmentViewer attachment={viewAttachment} onClose={() => setViewAttachment(null)} />}
      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Details</div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {isPO && (
            <>
              <div className="sm:col-span-2"><span className="text-slate-500">Supplier:</span> <strong>{r.supplierName}</strong></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Address:</span> {r.supplierAddress}</div>
              {r.isInternational ? (
                <>
                  <div><span className="text-slate-500">Country:</span> {r.supplierCountry} <span className="text-fuchsia-600">(Intl)</span></div>
                  {r.supplierTaxId && <div><span className="text-slate-500">Tax ID:</span> <span className="font-mono">{r.supplierTaxId}</span></div>}
                </>
              ) : (
                r.supplierGST && <div><span className="text-slate-500">GSTIN:</span> <span className="font-mono">{r.supplierGST}</span></div>
              )}
              <div><span className="text-slate-500">Delivery:</span> {r.deliveryTimeline}</div>
              <div><span className="text-slate-500">Terms:</span> {r.paymentTerms}</div>
              <div className="sm:col-span-2"><span className="text-slate-500">Scope:</span> <span className="whitespace-pre-wrap">{r.scope}</span></div>
              {r.lineItems && r.lineItems.length > 0 && (
                <div className="sm:col-span-2 bg-purple-50 rounded p-2 border border-purple-200">
                  <div className="text-xs font-bold text-purple-900 mb-1">📋 Line Items ({r.lineItems.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-slate-600 font-semibold"><th className="p-1">#</th><th className="p-1">Description</th><th className="p-1 text-right">Qty</th><th className="p-1">Unit</th><th className="p-1 text-right">Cost</th><th className="p-1 text-right">GST</th><th className="p-1 text-right">Total</th></tr></thead>
                      <tbody>
                        {r.lineItems.map((li, idx) => {
                          const sub = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                          const gst = sub * (parseFloat(li.gstPct || 0) / 100);
                          return <tr key={li.id || idx} className="border-t border-purple-200"><td className="p-1">{idx + 1}</td><td className="p-1">{li.description}</td><td className="p-1 text-right">{li.qty}</td><td className="p-1">{li.unit}</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{parseFloat(li.unitCost || 0).toLocaleString("en-IN")}</td><td className="p-1 text-right">{li.gstPct}%</td><td className="p-1 text-right font-semibold">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(sub + gst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>;
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-purple-300 bg-white"><td colSpan={6} className="p-1 text-right font-semibold">Subtotal:</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
                        <tr className="bg-white"><td colSpan={6} className="p-1 text-right font-semibold">GST:</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
                        <tr className="bg-purple-100 font-bold"><td colSpan={6} className="p-1 text-right">Grand Total:</td><td className="p-1 text-right">{(CURRENCIES.find(c => c.code === r.currency)?.symbol || "₹")}{(r.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              {r.editReason && <div className="sm:col-span-2"><span className="text-slate-500">Edit Reason:</span> {r.editReason}</div>}
              {r.changeNote && <div className="sm:col-span-2"><span className="text-slate-500">Change:</span> {r.changeNote}</div>}
              {r.reason && <div className="sm:col-span-2"><span className="text-slate-500">Cancellation Reason:</span> {r.reason}</div>}
            </>
          )}
          {!isPO && r.description && !isBudget && <div className="sm:col-span-2"><span className="text-slate-500">Description:</span> {r.description}</div>}
          {!isPO && r.scope && <div className="sm:col-span-2"><span className="text-slate-500">Scope:</span> {r.scope}</div>}
          {r.justification && <div className="sm:col-span-2"><span className="text-slate-500">Justification:</span> {r.justification}</div>}
          {r.expectedOutcome && <div className="sm:col-span-2"><span className="text-slate-500">Expected:</span> {r.expectedOutcome}</div>}
          {r.rdType && <div><span className="text-slate-500">R&D Type:</span> {r.rdType}</div>}
          {!isPO && r.reason && <div className="sm:col-span-2"><span className="text-slate-500">Reason:</span> {r.reason}</div>}
          {!isBudget && !isPO && r.purpose && <div className="sm:col-span-2"><span className="text-slate-500">Purpose:</span> {r.purpose}</div>}
          {r.linkedPONumber && <div className="sm:col-span-2 bg-fuchsia-50 p-2 rounded border border-fuchsia-200"><span className="text-fuchsia-900 font-semibold">Linked PO:</span> <span className="font-mono">{r.linkedPONumber}</span></div>}
          {r.clientOrderValue > 0 && <div><span className="text-slate-500">Client Order:</span> ₹{(r.clientOrderValue / 100000).toFixed(2)}L</div>}
          {r.startDate && <div><span className="text-slate-500">Start:</span> {r.startDate}</div>}
          {r.endDate && <div><span className="text-slate-500">End:</span> {r.endDate}</div>}
          {r.invoiceNumber && <div><span className="text-slate-500">Invoice:</span> <span className="font-mono">{r.invoiceNumber}</span></div>}
          {r.travelFrom && <div><span className="text-slate-500">From:</span> {r.travelFrom}</div>}
          {r.travelTo && <div><span className="text-slate-500">To:</span> {r.travelTo}</div>}
          {r.travelDates && <div><span className="text-slate-500">Dates:</span> {r.travelDates}</div>}
          {r.attachment && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Attachment:</span>{" "}
              <button onClick={() => setViewAttachment(r.attachment)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 underline font-medium"><Paperclip className="w-3 h-3" />{r.attachment.name}</button>
            </div>
          )}
          {r.paymentProof && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Payment Proof:</span>{" "}
              <button onClick={() => setViewAttachment(r.paymentProof)} className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 underline font-medium"><Paperclip className="w-3 h-3" />{r.paymentProof.name}</button>
            </div>
          )}
          {r.paymentUTR && (
            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded p-2">
              <span className="text-emerald-900 font-semibold">Payment Details:</span>
              <div className="text-xs text-emerald-800 mt-1">
                {r.paymentUTR && <div>UTR: <span className="font-mono">{r.paymentUTR}</span></div>}
                {r.paymentMode && <div>Mode: {r.paymentMode}</div>}
                {r.paymentDate && <div>Date: {r.paymentDate}</div>}
                {r.paidBy && <div>Paid by: {r.paidBy}</div>}
              </div>
            </div>
          )}
          {r.selectedApprovers && r.selectedApprovers.length > 0 && <div className="sm:col-span-2"><span className="text-slate-500">Approvers:</span> {r.selectedApprovers.map(id => USERS.find(u => u.id === id)?.name).filter(Boolean).join(" + ")}</div>}
        </div>
      </div>
      {isPOEdit && originalPO && (
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Edit3 className="w-3 h-3" />Changes (Old vs New)</div>
          <div className="bg-slate-50 rounded-lg p-2 text-xs">
            <div className="grid grid-cols-3 gap-1 font-semibold text-slate-600 pb-1 border-b border-slate-200">
              <div>Field</div><div>Current (v{originalPO.version || 1})</div><div>Proposed</div>
            </div>
            {(() => {
              const fields = [
                { key: "supplierName", label: "Supplier" },
                { key: "supplierAddress", label: "Address" },
                { key: "supplierGST", label: "GSTIN" },
                { key: "isInternational", label: "International?", format: v => v ? "Yes" : "No" },
                { key: "amountINR", label: "Grand Total (INR)", format: v => "₹" + ((v || 0) / 100000).toFixed(2) + "L" },
                { key: "subtotal", label: "Subtotal", format: v => "₹" + ((v || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 }) },
                { key: "totalGST", label: "Total GST", format: v => "₹" + ((v || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 }) },
                { key: "scope", label: "Scope" },
                { key: "deliveryTimeline", label: "Delivery" },
                { key: "paymentTerms", label: "Terms" },
              ];
              return fields.map(f => {
                const oldVal = originalPO[f.key] ?? "—";
                const newVal = r[f.key] ?? "—";
                const changed = String(oldVal) !== String(newVal);
                const fmt = f.format || (v => v);
                return (
                  <div key={f.key} className={`grid grid-cols-3 gap-1 py-1 border-b border-slate-100 last:border-0 ${changed ? "bg-amber-50 -mx-2 px-2" : ""}`}>
                    <div className="text-slate-500">{f.label}{changed && " ✏️"}</div>
                    <div className={`${changed ? "text-slate-700 line-through" : ""} break-words`}>{fmt(oldVal)}</div>
                    <div className={`${changed ? "text-emerald-700 font-semibold" : ""} break-words`}>{fmt(newVal)}</div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Line items diff */}
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-700 mb-1">Line Items Comparison</div>
            <div className="grid md:grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded p-2">
                <div className="text-xs font-semibold text-slate-600 mb-1">Current ({(originalPO.lineItems || []).length} lines)</div>
                {(originalPO.lineItems || []).length === 0 ? <div className="text-xs text-slate-400 italic">No line items</div> : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">GST</th></tr></thead>
                    <tbody>
                      {originalPO.lineItems.map((li, i) => <tr key={i} className="border-t border-slate-200"><td className="py-0.5">{li.description}</td><td className="text-right">{li.qty} {li.unit}</td><td className="text-right">{parseFloat(li.unitCost).toLocaleString("en-IN")}</td><td className="text-right">{li.gstPct}%</td></tr>)}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-emerald-50 rounded p-2">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Proposed ({(r.lineItems || []).length} lines)</div>
                {(r.lineItems || []).length === 0 ? <div className="text-xs text-slate-400 italic">No line items</div> : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">GST</th></tr></thead>
                    <tbody>
                      {r.lineItems.map((li, i) => <tr key={i} className="border-t border-emerald-200"><td className="py-0.5">{li.description}</td><td className="text-right">{li.qty} {li.unit}</td><td className="text-right">{parseFloat(li.unitCost).toLocaleString("en-IN")}</td><td className="text-right">{li.gstPct}%</td></tr>)}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {r.editReason && <div className="mt-2 text-xs"><span className="text-slate-500">Reason:</span> {r.editReason}</div>}
          {r.changeNote && <div className="mt-1 text-xs italic">"{r.changeNote}"</div>}
        </div>
      )}
      {r.editHistory && r.editHistory.length > 0 && (
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><History className="w-3 h-3" />Edit History</div>
          <div className="space-y-1">
            {r.editHistory.map((eh, i) => (
              <div key={i} className="bg-slate-50 rounded p-2 text-xs">
                <div className="font-semibold">v{eh.version} · {new Date(eh.at).toLocaleString("en-IN", { day: "numeric", month: "short" })} · By {eh.by}</div>
                {eh.changeNote && <div className="italic">"{eh.changeNote}"</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-bold text-slate-700 mb-2">Approval History ({r.history?.length || 0})</div>
        <div className="space-y-1.5">
          {(r.history || []).map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${h.action.includes("Reject") ? "bg-red-100 text-red-600" : ["Paid", "Active", "Approved"].includes(h.action) ? "bg-emerald-100 text-emerald-600" : h.action === "Cancelled" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-600"}`}>
                {h.action.includes("Reject") ? <XCircle className="w-3 h-3" /> : h.action === "Cancelled" ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{h.action}</div>
                <div className="text-slate-600">By {h.by} · {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                {h.comments && <div className="text-slate-500 italic mt-0.5">"{h.comments}"</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ ACTION BUTTONS ============
function ActionButtons({ request, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs, savePOCounter, poCounter, addNotifications, showToast }) {
  const [mode, setMode] = useState(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ utr: "", paymentMode: "Bank Transfer", paymentDate: new Date().toISOString().slice(0, 10), proofAttachment: null, note: "" });
  const [poNumberInput, setPONumberInput] = useState("");

  const isBudget = request.kind === "Budget";
  const isPO = request.kind === "PO";
  const reqKind = isBudget ? "Budget" : isPO ? "PO" : "Payment";

  const isSuperManager = user.role === "SuperManager";
  const isPOAtSuperStage = isPO && request.currentStage === "SuperManagerApproval";
  const isEarlyStage = !["FinanceHead", "Accountant", "Processing"].includes(request.currentStage);

  async function handlePaymentProofUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPaymentForm({ ...paymentForm, proofAttachment: { name: file.name, size: file.size, type: file.type, data: ev.target.result, uploadedAt: new Date().toISOString() } }); };
    reader.readAsDataURL(file);
  }

  async function doAction(actionType) {
    if (actionType === "reject" && !comments.trim()) { alert("Reason mandatory"); return; }
    setBusy(true);
    const now = new Date().toISOString();
    let actionLabel = "";
    let newStage = request.currentStage;
    let newStatus = request.status;
    let extraUpdates = {};

    if (actionType === "approve") {
      // Super manager override (but not for PO at SuperManagerApproval — that's their actual stage)
      if (isSuperManager && isEarlyStage && !isPOAtSuperStage) {
        actionLabel = `Approved by ${user.name}`;
        if (isBudget) { newStage = "Active"; newStatus = "Active"; }
        else if (isPO) { newStage = "Accountant"; newStatus = getStageLabel("Accountant", "PO"); }
        else { newStage = "Accountant"; newStatus = getStageLabel("Accountant", "Payment"); }
      } else {
        const stageName = {
          "BoxBuildMid": "Approved by Delivery Head",
          "DeptApproval": "Approved (Dept)",
          "VP": "Approved by VP",
          "CEO": "Approved by CEO",
          "SuperManagerApproval": `Approved by ${user.name}`,
          "FinanceHead": "Approved by Finance Head",
          "Accountant": isPO ? (request.type === "POEdit" ? "Edit Applied" : request.type === "POCancel" ? "Cancellation Applied" : "PO Number Assigned") : "Processing",
        }[request.currentStage] || "Approved";
        actionLabel = stageName;

        // PO Accountant stage — special handling for create/edit/cancel
        if (isPO && request.currentStage === "Accountant") {
          if (request.type === "POEdit") {
            const originalPO = pos_all.find(p => p.id === request.editingPOId);
            if (originalPO) {
              const newVersion = (originalPO.version || 1) + 1;
              const updatedPO = {
                ...originalPO,
                supplierName: request.supplierName, supplierAddress: request.supplierAddress, supplierGST: request.supplierGST,
                isInternational: request.isInternational, supplierCountry: request.supplierCountry, supplierTaxId: request.supplierTaxId,
                lineItems: request.lineItems ? JSON.parse(JSON.stringify(request.lineItems)) : originalPO.lineItems,
                subtotal: request.subtotal, totalGST: request.totalGST,
                amount: request.amount, currency: request.currency, fxRate: request.fxRate, amountINR: request.amountINR,
                scope: request.scope, deliveryTimeline: request.deliveryTimeline, paymentTerms: request.paymentTerms,
                version: newVersion,
                editHistory: [...(originalPO.editHistory || []), { version: newVersion, by: request.requesterName, at: now, changeNote: request.changeNote, reason: request.editReason }],
                history: [...(originalPO.history || []), { action: `Updated to v${newVersion}`, by: user.name, byId: user.id, at: now, comments: `Edit ${request.id} applied: ${request.changeNote}` }],
              };
              const editApproved = { ...request, currentStage: "Approved", status: "Approved", approvedBy: `${user.name} (${user.designation})`, approvedDate: now, history: [...request.history, { action: actionLabel, by: user.name, byId: user.id, at: now, comments: comments.trim() }] };
              const otherPOs = pos_all.filter(p => p.id !== originalPO.id && p.id !== request.id);
              await savePOs([editApproved, updatedPO, ...otherPOs]);

              // Notify requester + dept heads
              if (addNotifications) {
                const notifs = [{ id: "N-" + Date.now() + "-poe", toUserId: request.requesterId, title: "PO Edit Applied", message: `Your edit request for ${originalPO.poNumber} is approved. Now at v${newVersion}.`, at: now, read: false, requestId: request.id }];
                getDeptHeadsForDept(request.dept, request.isProject).forEach((dh, idx) => { if (dh.id !== request.requesterId && dh.id !== user.id) notifs.push({ id: "N-" + Date.now() + "-pod-" + idx, toUserId: dh.id, title: "PO Updated", message: `${originalPO.poNumber} updated to v${newVersion} by ${user.name}.`, at: now, read: false, requestId: request.id }); });
                await addNotifications(notifs);
              }

              if (showToast) showToast(`PO ${originalPO.poNumber} updated to v${newVersion}`, "success");
              setBusy(false); setMode(null); setComments(""); setPONumberInput(""); return;
            }
          } else if (request.type === "POCancel") {
            const originalPO = pos_all.find(p => p.id === request.cancellingPOId);
            if (originalPO) {
              const cancelledPO = { ...originalPO, status: "Cancelled", currentStage: "Cancelled", cancelledAt: now, cancelReason: request.reason, history: [...(originalPO.history || []), { action: "Cancelled", by: user.name, byId: user.id, at: now, comments: `Cancellation ${request.id} applied: ${request.reason}` }] };
              const cancelApproved = { ...request, currentStage: "Approved", status: "Approved", approvedBy: `${user.name}`, approvedDate: now, history: [...request.history, { action: "Cancellation Applied", by: user.name, byId: user.id, at: now, comments: comments.trim() }] };
              const otherPOs = pos_all.filter(p => p.id !== originalPO.id && p.id !== request.id);
              await savePOs([cancelApproved, cancelledPO, ...otherPOs]);

              if (addNotifications) {
                const notifs = [{ id: "N-" + Date.now() + "-poc", toUserId: request.requesterId, title: "PO Cancelled", message: `${originalPO.poNumber} (${originalPO.supplierName}) has been cancelled.`, at: now, read: false, requestId: request.id }];
                if (originalPO.requesterId !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-poco", toUserId: originalPO.requesterId, title: "Your PO was Cancelled", message: `${originalPO.poNumber} cancelled. Reason: ${request.reason}`, at: now, read: false, requestId: request.id });
                getDeptHeadsForDept(originalPO.dept, originalPO.isProject).forEach((dh, idx) => { if (dh.id !== user.id && dh.id !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-pocd-" + idx, toUserId: dh.id, title: "PO Cancelled", message: `${originalPO.poNumber} cancelled.`, at: now, read: false, requestId: request.id }); });
                await addNotifications(notifs);
              }

              if (showToast) showToast(`PO ${originalPO.poNumber} cancelled`, "warning");
              setBusy(false); setMode(null); setComments(""); setPONumberInput(""); return;
            }
          } else {
            // POCreate: assign PO number
            const newCounter = poCounter + 1;
            const assignedNumber = poNumberInput.trim() || formatPONumber(newCounter);
            await savePOCounter(newCounter);
            extraUpdates = { poNumber: assignedNumber, approvedBy: `${user.name} (${user.designation})`, approvedDate: now };
            newStage = "Approved"; newStatus = "Approved";
            actionLabel = `PO Number Assigned: ${assignedNumber}`;
          }
        } else if (isPO && request.type === "POCancel" && request.currentStage === "FinanceHead") {
          // Finance Head approves cancel directly (no Accountant step needed for cancel)
          const originalPO = pos_all.find(p => p.id === request.cancellingPOId);
          if (originalPO) {
            const cancelledPO = { ...originalPO, status: "Cancelled", currentStage: "Cancelled", cancelledAt: now, cancelReason: request.reason, history: [...(originalPO.history || []), { action: "Cancelled", by: user.name, byId: user.id, at: now, comments: `Cancellation ${request.id} approved: ${request.reason}` }] };
            const cancelApproved = { ...request, currentStage: "Approved", status: "Approved", approvedBy: `${user.name}`, approvedDate: now, history: [...request.history, { action: "Cancellation Approved", by: user.name, byId: user.id, at: now, comments: comments.trim() }] };
            const otherPOs = pos_all.filter(p => p.id !== originalPO.id && p.id !== request.id);
            await savePOs([cancelApproved, cancelledPO, ...otherPOs]);

            if (addNotifications) {
              const notifs = [{ id: "N-" + Date.now() + "-poc", toUserId: request.requesterId, title: "PO Cancelled", message: `${originalPO.poNumber} (${originalPO.supplierName}) has been cancelled.`, at: now, read: false, requestId: request.id }];
              if (originalPO.requesterId !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-poco", toUserId: originalPO.requesterId, title: "Your PO was Cancelled", message: `${originalPO.poNumber} cancelled. Reason: ${request.reason}`, at: now, read: false, requestId: request.id });
              await addNotifications(notifs);
            }

            if (showToast) showToast(`PO ${originalPO.poNumber} cancelled`, "warning");
            setBusy(false); setMode(null); setComments(""); setPONumberInput(""); return;
          }
        } else if (request.currentStage === "DeptApproval" && request.selectedApprovers && request.selectedApprovers.length > 1) {
          const approvalsReceived = request.history.filter(h => h.action === "Approved (Dept)").length + 1;
          if (approvalsReceived < request.selectedApprovers.length) {
            newStage = "DeptApproval";
            newStatus = getStageLabel(newStage, reqKind) + ` (${approvalsReceived}/${request.selectedApprovers.length})`;
          } else {
            newStage = computeNextStage({ ...request, kind: reqKind }, "DeptApproval", user);
            newStatus = newStage === "Active" ? "Active" : newStage === "Approved" ? "Approved" : getStageLabel(newStage, reqKind);
          }
        } else {
          newStage = computeNextStage({ ...request, kind: reqKind }, request.currentStage, user);
          newStatus = newStage === "Active" ? "Active" : newStage === "Approved" ? "Approved" : getStageLabel(newStage, reqKind);
        }
      }
    } else if (actionType === "reject") {
      actionLabel = `Rejected at ${getStageLabel(request.currentStage, reqKind)}`;
      newStage = "Rejected"; newStatus = "Rejected";
    } else if (actionType === "process") {
      actionLabel = "Started Processing"; newStage = "Processing"; newStatus = "Processing Payment";
    } else if (actionType === "pay") {
      actionLabel = "Paid"; newStage = "Paid"; newStatus = "Paid";
      extraUpdates = { paymentUTR: paymentForm.utr.trim() || null, paymentMode: paymentForm.paymentMode, paymentDate: paymentForm.paymentDate, paymentProof: paymentForm.proofAttachment, paidAt: now, paidBy: user.name, paidById: user.id };
    } else if (actionType === "undopay") {
      actionLabel = `Payment Undone by ${user.name}`;
      newStage = "Processing"; newStatus = "Processing Payment";
      extraUpdates = { paymentUTR: null, paymentMode: null, paymentDate: null, paymentProof: null, paidAt: null, paidBy: null };
    }

    let paymentNote = "";
    if (actionType === "pay") {
      const parts = [];
      if (paymentForm.utr) parts.push(`UTR: ${paymentForm.utr}`);
      parts.push(`Mode: ${paymentForm.paymentMode}`);
      parts.push(`Date: ${paymentForm.paymentDate}`);
      if (paymentForm.note) parts.push(paymentForm.note);
      paymentNote = parts.join(" · ");
    }

    const updateFn = (item) => {
      if (item.id !== request.id) return item;
      const updates = {
        ...item, ...extraUpdates,
        currentStage: newStage, status: newStatus,
        history: [...item.history, { action: actionLabel, by: user.name, byId: user.id, at: now, comments: comments.trim() || paymentNote || (actionType === "approve" ? "Approved" : "") }]
      };
      if (isBudget && newStage === "Active" && !item.approvedBy) { updates.approvedBy = `${user.name} (${user.designation})`; updates.approvedDate = now; }
      if (isPO && newStage === "Approved" && !item.approvedDate) { updates.approvedBy = `${user.name} (${user.designation})`; updates.approvedDate = now; }
      return updates;
    };

    if (isBudget) await saveBudgets(budgets_all.map(updateFn));
    else if (isPO) await savePOs(pos_all.map(updateFn));
    else {
      const updatedRequests = requests_all.map(updateFn);
      await saveRequests(updatedRequests);
      // Auto-close PO if 100% paid after this payment
      if (actionType === "pay" && request.linkedPOId) {
        const linkedPOItem = pos_all.find(p => p.id === request.linkedPOId);
        if (linkedPOItem && (linkedPOItem.status === "Approved" || linkedPOItem.currentStage === "Approved")) {
          const totalPaidAfter = updatedRequests
            .filter(r => r.linkedPOId === linkedPOItem.id && r.status === "Paid")
            .reduce((s, r) => s + (r.amountINR || r.amount), 0);
          if (totalPaidAfter >= linkedPOItem.amountINR) {
            const closedPO = {
              ...linkedPOItem,
              status: "Closed",
              currentStage: "Closed",
              closedAt: now,
              history: [...(linkedPOItem.history || []), { action: "Auto-Closed (100% paid)", by: "System", byId: "SYS", at: now, comments: `Fully consumed. Final payment ${request.id} of ₹${(request.amountINR / 100000).toFixed(2)}L brought total paid to ₹${(totalPaidAfter / 100000).toFixed(2)}L.` }],
            };
            const updatedPOs = pos_all.map(p => p.id === linkedPOItem.id ? closedPO : p);
            await savePOs(updatedPOs);
            if (showToast) showToast(`PO ${linkedPOItem.poNumber} auto-closed (fully paid)`, "info");
          }
        }
      }
    }

    if (actionType === "pay" && addNotifications) {
      const notifs = [{ id: "N-" + Date.now() + "-1", toUserId: request.requesterId, title: "Payment Completed", message: `Your request ${request.id} (₹${(request.amountINR || request.amount).toLocaleString("en-IN")}) has been paid.${paymentForm.utr ? ` UTR: ${paymentForm.utr}` : ""}`, at: now, read: false, requestId: request.id }];
      const deptHeads = getDeptHeadsForDept(request.dept, request.isProject);
      deptHeads.forEach((dh, idx) => { if (dh.id !== request.requesterId) notifs.push({ id: "N-" + Date.now() + "-dh-" + idx, toUserId: dh.id, title: "Payment in Your Dept", message: `${request.requesterName}'s request ${request.id} paid.`, at: now, read: false, requestId: request.id }); });
      const fh = USERS.find(u => u.role === "FinanceHead");
      if (fh && fh.id !== user.id) notifs.push({ id: "N-" + Date.now() + "-fh", toUserId: fh.id, title: "Payment Completed", message: `${request.id} — ${request.requesterName} — ₹${(request.amountINR || request.amount).toLocaleString("en-IN")}`, at: now, read: false, requestId: request.id });
      await addNotifications(notifs);
      if (showToast) showToast("Payment paid. Notifications sent.", "success");
    }

    // Notify on PO Create approval (when PO number is assigned)
    if (actionType === "approve" && isPO && request.type === "POCreate" && newStage === "Approved" && addNotifications) {
      const assignedNum = extraUpdates.poNumber || request.poNumber;
      const notifs = [{ id: "N-" + Date.now() + "-poa", toUserId: request.requesterId, title: "PO Approved", message: `Your PO request is approved with number ${assignedNum}. You can now raise payments against it.`, at: now, read: false, requestId: request.id }];
      getDeptHeadsForDept(request.dept, request.isProject).forEach((dh, idx) => { if (dh.id !== request.requesterId && dh.id !== user.id) notifs.push({ id: "N-" + Date.now() + "-poad-" + idx, toUserId: dh.id, title: "PO Approved in Your Dept", message: `${assignedNum} (${request.supplierName}) approved for ₹${(request.amountINR / 100000).toFixed(2)}L.`, at: now, read: false, requestId: request.id }); });
      await addNotifications(notifs);
    }

    if (actionType === "undopay" && showToast) showToast("Payment reversal logged.", "warning");
    if (actionType === "approve" && showToast) showToast("Approved", "success");
    if (actionType === "reject" && showToast) showToast("Rejected", "info");

    setBusy(false); setMode(null); setComments(""); setPONumberInput("");
    setPaymentForm({ utr: "", paymentMode: "Bank Transfer", paymentDate: new Date().toISOString().slice(0, 10), proofAttachment: null, note: "" });
  }

  const stage = request.currentStage;
  const isApprovalStage = ["BoxBuildMid", "DeptApproval", "VP", "CEO", "SuperManagerApproval", "FinanceHead"].includes(stage);
  const isPOAccountant = isPO && stage === "Accountant";
  const isProcessStage = stage === "Accountant" && !isBudget && !isPO;
  const isPayStage = stage === "Processing" && !isBudget && !isPO;
  const canSuperMarkPaid = isSuperManager && !isBudget && !isPO && (stage === "Accountant" || stage === "Processing");
  const canUndoPaid = stage === "Paid" && request.paidAt && user.role === "Accountant" && (Date.now() - new Date(request.paidAt).getTime() < 24 * 60 * 60 * 1000);

  return (
    <div className="mt-3">
      {!mode && (
        <div className="flex gap-2 flex-wrap">
          {isApprovalStage && (
            <>
              <button onClick={() => setMode("approve")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Approve</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {isPOAccountant && (
            <>
              <button onClick={() => setMode("po-assign")} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5" />{request.type === "POEdit" ? "Apply Edit" : request.type === "POCancel" ? "Apply Cancel" : "Assign PO Number"}</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {isProcessStage && !isSuperManager && (
            <>
              <button onClick={() => setMode("process")} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Start Processing</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {isPayStage && !isSuperManager && (
            <>
              <button onClick={() => setMode("pay")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Mark as Paid</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {canSuperMarkPaid && (
            <>
              {stage === "Accountant" && <button onClick={() => setMode("process")} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Start Processing</button>}
              <button onClick={() => setMode("pay")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Mark Paid Directly</button>
              <button onClick={() => setMode("reject")} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Reject</button>
            </>
          )}
          {canUndoPaid && (
            <button onClick={() => setMode("undopay")} className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Undo2 className="w-3.5 h-3.5" />Undo Payment</button>
          )}
        </div>
      )}

      {/* PO Number Assignment / Apply Edit / Apply Cancel */}
      {mode === "po-assign" && (
        <div className="space-y-3 bg-fuchsia-50 p-4 rounded-lg border border-fuchsia-200">
          <div className="text-sm font-semibold text-fuchsia-900 flex items-center gap-1.5">
            <FileSignature className="w-4 h-4" />
            {request.type === "POEdit" ? `Apply Edit to ${request.editingPONumber}` : request.type === "POCancel" ? `Cancel ${request.cancellingPONumber}` : "Assign PO Number"}
          </div>
          {request.type !== "POEdit" && request.type !== "POCancel" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PO Number</label>
              <input value={poNumberInput} onChange={(e) => setPONumberInput(e.target.value)} placeholder={`Auto: ${formatPONumber(poCounter + 1)}`} className="w-full text-xs px-2 py-1.5 border border-fuchsia-300 rounded-lg font-mono" />
              <p className="text-xs text-slate-500 mt-1">Leave blank to auto-assign {formatPONumber(poCounter + 1)}, or type a custom number.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Comment (optional)</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => doAction("approve")} disabled={busy} className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              {request.type === "POEdit" ? "Apply Edit" : request.type === "POCancel" ? "Confirm Cancellation" : "Assign & Approve"}
            </button>
            <button onClick={() => { setMode(null); setComments(""); setPONumberInput(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Payment marking */}
      {mode === "pay" && (
        <div className="space-y-3 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <div className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5"><CheckSquare className="w-4 h-4" />Record Payment Details</div>
          <p className="text-xs text-emerald-700">UTR and proof recommended for audit.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">UTR / Ref</label><input value={paymentForm.utr} onChange={(e) => setPaymentForm({ ...paymentForm, utr: e.target.value })} placeholder="UTR123456" className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">Mode</label>
              <select value={paymentForm.paymentMode} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg">
                <option>Bank Transfer</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option><option>Cash</option><option>Credit Card</option><option>Other</option>
              </select>
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label><input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" /></div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Proof</label>
            {!paymentForm.proofAttachment ? (
              <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-white text-xs">
                <Upload className="w-4 h-4" />Upload proof (optional, max 2MB)
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handlePaymentProofUpload} />
              </label>
            ) : (
              <div className="bg-white border border-emerald-200 rounded-lg p-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><Paperclip className="w-3 h-3 text-emerald-700" /><span className="font-medium">{paymentForm.proofAttachment.name}</span></div>
                <button onClick={() => setPaymentForm({ ...paymentForm, proofAttachment: null })} className="text-red-600"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">Note</label><input value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => doAction("pay")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirm Payment Done</button>
            <button onClick={() => setMode(null)} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Undo Pay */}
      {mode === "undopay" && (
        <div className="space-y-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Reverse this payment</div>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Reason for reversal (mandatory)" rows={2} className="w-full text-xs px-2 py-1.5 border border-amber-200 rounded-lg" />
          <div className="flex gap-2">
            <button onClick={() => { if (!comments.trim()) { alert("Reason mandatory"); return; } doAction("undopay"); }} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirm Undo</button>
            <button onClick={() => { setMode(null); setComments(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Approve / Reject / Process modes */}
      {mode && !["pay", "undopay", "po-assign"].includes(mode) && (
        <div className={`space-y-2 p-3 rounded-lg border ${mode === "reject" ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
          <div className={`text-xs font-semibold flex items-center gap-1.5 ${mode === "reject" ? "text-red-900" : "text-slate-900"}`}>
            {mode === "reject" && <><AlertTriangle className="w-3.5 h-3.5" />Reason mandatory</>}
            {mode === "approve" && "Add comment (recommended)"}
            {mode === "process" && "Add note (optional)"}
          </div>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={mode === "reject" ? "Why?" : "Optional"} rows={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg" />
          <div className="flex gap-2">
            <button onClick={() => doAction(mode)} disabled={busy || (mode === "reject" && !comments.trim())} className={`text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:bg-slate-400 ${mode === "reject" ? "bg-red-600" : "bg-emerald-600"}`}>Confirm {mode}</button>
            <button onClick={() => { setMode(null); setComments(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ CANCEL BUTTON ============
function CancelButton({ request, user, requests_all, budgets_all, pos_all, saveRequests, saveBudgets, savePOs }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const isBudget = request.kind === "Budget";
  const isPO = request.kind === "PO";

  async function doCancel() {
    if (!reason.trim()) { alert("Reason required"); return; }
    setBusy(true);
    const now = new Date().toISOString();
    const updateFn = (item) => item.id === request.id ? { ...item, status: "Cancelled", currentStage: "Cancelled", history: [...item.history, { action: "Cancelled by requester", by: user.name, byId: user.id, at: now, comments: reason }] } : item;
    if (isBudget) await saveBudgets(budgets_all.map(updateFn));
    else if (isPO) await savePOs(pos_all.map(updateFn));
    else await saveRequests(requests_all.map(updateFn));
    setBusy(false); setShowForm(false); setReason("");
  }

  return (
    <div className="mt-2">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" />Cancel this request</button>
      ) : (
        <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-900">Reason for cancellation</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg" />
          <div className="flex gap-2">
            <button onClick={doCancel} disabled={busy || !reason.trim()} className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirm Cancel</button>
            <button onClick={() => { setShowForm(false); setReason(""); }} className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">Nevermind</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ BUDGET VIEW ============
function BudgetView({ user, budgets, requests }) {
  const [tab, setTab] = useState("client");

  const clientProjects = budgets.filter(b => b.type === "Project" && b.projectType === "Client" && (b.status === "Active" || b.currentStage === "Active"));
  const rdProjects = budgets.filter(b => b.type === "Project" && b.projectType === "RD" && (b.status === "Active" || b.currentStage === "Active"));
  const monthlyBudgets = budgets.filter(b => b.type === "Monthly" && (b.status === "Active" || b.currentStage === "Active"));
  const extensions = budgets.filter(b => b.type === "Extension" && (b.status === "Active" || b.currentStage === "Active"));

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("client")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "client" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600"}`}><Briefcase className="w-4 h-4 inline mr-1" />Client ({clientProjects.length})</button>
        <button onClick={() => setTab("rd")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "rd" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}><Target className="w-4 h-4 inline mr-1" />R&D ({rdProjects.length})</button>
        <button onClick={() => setTab("monthly")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "monthly" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600"}`}>Monthly ({monthlyBudgets.length})</button>
        <button onClick={() => setTab("extensions")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "extensions" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600"}`}>Extensions ({extensions.length})</button>
      </div>

      {tab === "client" && (
        <div className="space-y-3">
          {clientProjects.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active client projects.</div>}
          {clientProjects.map(b => {
            const projReqs = requests.filter(r => r.projectId === b.projectId);
            const committed = projReqs.filter(r => !["Rejected", "Cancelled", "Paid"].includes(r.status)).reduce((s, r) => s + (r.amountINR || r.amount), 0);
            const paid = projReqs.filter(r => r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
            const util = ((paid + committed) / b.amountINR) * 100;
            const margin = ((b.clientOrderValue - b.amountINR) / b.clientOrderValue) * 100;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">CLIENT</span><div className="font-bold">{b.projectName}</div></div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{b.projectId}</div>
                    <div className="text-xs text-slate-600 mt-1">{b.dept} · Client: {b.client}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">Active</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 mb-3 text-xs">
                  <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Client Order</div><div className="font-bold">₹{(b.clientOrderValue / 100000).toFixed(2)}L</div></div>
                  <div className="bg-blue-50 rounded p-2"><div className="text-blue-700">Budget</div><div className="font-bold text-blue-900">₹{(b.amountINR / 100000).toFixed(2)}L</div></div>
                  <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Margin</div><div className="font-bold text-emerald-900">{margin.toFixed(1)}%</div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Utilization</span><span>Paid: ₹{(paid / 100000).toFixed(1)}L · Committed: ₹{(committed / 100000).toFixed(1)}L</span></div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: (paid / b.amountINR * 100) + "%" }}></div>
                    <div className="h-full bg-amber-400" style={{ width: (committed / b.amountINR * 100) + "%" }}></div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{util.toFixed(0)}% used</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "rd" && (
        <div className="space-y-3">
          {rdProjects.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active R&D projects.</div>}
          {rdProjects.map(b => {
            const paid = requests.filter(r => r.projectId === b.projectId && r.status === "Paid").reduce((s, r) => s + (r.amountINR || r.amount), 0);
            const committed = requests.filter(r => r.projectId === b.projectId && !["Paid", "Rejected", "Cancelled"].includes(r.status)).reduce((s, r) => s + (r.amountINR || r.amount), 0);
            return (
              <div key={b.id} className="bg-white rounded-xl border border-fuchsia-200 p-4">
                <div className="flex items-center gap-2 mb-2"><span className="text-xs px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 font-bold">R&D</span><span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{b.rdType}</span><div className="font-bold">{b.projectName}</div></div>
                <div className="text-xs text-slate-500 font-mono">{b.projectId} · {b.dept}</div>
                {b.justification && <div className="text-xs text-slate-600 mt-1 italic">💡 {b.justification}</div>}
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-fuchsia-50 rounded p-2"><div className="text-fuchsia-700">Budget</div><div className="font-bold">₹{(b.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Paid</div><div className="font-bold">₹{(paid / 1000).toFixed(1)}K</div></div>
                  <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Committed</div><div className="font-bold">₹{(committed / 1000).toFixed(1)}K</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "monthly" && (
        <div className="space-y-3">
          {monthlyBudgets.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active monthly budgets.</div>}
          {monthlyBudgets.map(b => {
            const usage = getMonthlyBudgetUsage(requests, b.dept, b.category, b.month);
            const avail = Math.max(0, b.amountINR - usage.total);
            const util = (usage.total / b.amountINR) * 100;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <div className="font-bold">{b.dept} → {b.category}</div>
                    <div className="text-xs text-slate-500">Month: {b.month} · Approved by {b.approvedBy} · Pool open to all {b.dept} members</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">Active Pool</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(b.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Used</div><div className="font-bold">₹{(usage.total / 1000).toFixed(1)}K</div></div>
                  <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Available</div><div className="font-bold">₹{(avail / 1000).toFixed(1)}K</div></div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${util > 90 ? "bg-red-500" : util > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: Math.min(util, 100) + "%" }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "extensions" && (
        <div className="space-y-3">
          {extensions.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No active extensions.</div>}
          {extensions.map(e => {
            const parent = budgets.find(b => b.projectId === e.extensionFor && b.type === "Project");
            return (
              <div key={e.id} className="bg-white rounded-xl border border-amber-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold">Extension: {parent?.projectName || e.extensionFor}</div>
                    <div className="text-xs text-slate-500 font-mono">{e.extensionFor}</div>
                    <div className="text-xs italic mt-1">{e.reason}</div>
                  </div>
                  <div className="text-lg font-bold">+₹{(e.amountINR / 100000).toFixed(2)}L</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ PO LIST VIEW ============
function POListView({ user, pos, requests, budgets, savePOs, savePOCounter, poCounter, addNotifications, showToast }) {
  const [tab, setTab] = useState("approved");
  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);

  if (editTarget) {
    return (
      <div>
        <button onClick={() => setEditTarget(null)} className="mb-3 text-sm text-blue-600 hover:text-blue-700 font-medium">← Back to POs</button>
        <NewPORequestForm user={user} budgets={budgets} pos={pos} requests={requests} savePOs={savePOs} editFor={editTarget} onSuccess={() => { setEditTarget(null); showToast("Edit request submitted", "success"); }} />
      </div>
    );
  }

  async function manuallyClosePO(po) {
    if (!confirm(`Close PO ${po.poNumber}? No new payments can be raised against it after closing.`)) return;
    const now = new Date().toISOString();
    const updated = pos.map(p => p.id === po.id ? {
      ...p,
      status: "Closed",
      currentStage: "Closed",
      closedAt: now,
      history: [...(p.history || []), { action: "Manually Closed", by: user.name, byId: user.id, at: now, comments: "Closed by Finance Head" }]
    } : p);
    await savePOs(updated);
    showToast(`PO ${po.poNumber} closed`, "info");
    setCloseTarget(null);
  }

  // Only show actual PO records (POCreate) — edits/cancels are tracked elsewhere
  const allPOs = pos.filter(p => p.type === "POCreate");
  const approved = allPOs.filter(p => p.status === "Approved" || p.currentStage === "Approved");
  const pending = pos.filter(p => !["Approved", "Closed", "Cancelled", "Rejected"].includes(p.status));
  const closed = allPOs.filter(p => p.status === "Closed");
  const cancelled = allPOs.filter(p => p.status === "Cancelled");
  const rejected = pos.filter(p => p.status === "Rejected");

  const list = tab === "approved" ? approved : tab === "pending" ? pending : tab === "closed" ? closed : tab === "cancelled" ? cancelled : rejected;

  return (
    <div>
      {cancelTarget && <POCancelModal po={cancelTarget} user={user} pos={pos} savePOs={savePOs} onClose={() => setCancelTarget(null)} showToast={showToast} />}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("approved")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "approved" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Approved ({approved.length})</button>
        <button onClick={() => setTab("pending")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "pending" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Pending ({pending.length})</button>
        <button onClick={() => setTab("closed")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "closed" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Closed ({closed.length})</button>
        <button onClick={() => setTab("cancelled")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "cancelled" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Cancelled ({cancelled.length})</button>
        <button onClick={() => setTab("rejected")} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === "rejected" ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-600"}`}>Rejected ({rejected.length})</button>
      </div>
      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No POs in this category.</div>
      ) : (
        <div className="space-y-2">
          {list.map(po => <POCard key={po.id} po={po} requests={requests} pos={pos} user={user} onEdit={() => setEditTarget(po)} onCancel={() => setCancelTarget(po)} onClose={() => manuallyClosePO(po)} />)}
        </div>
      )}
    </div>
  );
}

function POCard({ po, requests, pos, user, onEdit, onCancel, onClose: onCloseManually }) {
  const [expanded, setExpanded] = useState(false);
  const [viewAttachment, setViewAttachment] = useState(null);
  const usage = getPOUsage(requests, po.id);
  const available = getPOAvailable(po, requests);
  const linkedReqs = requests.filter(r => r.linkedPOId === po.id);
  const isApproved = po.status === "Approved" || po.currentStage === "Approved";
  const isCancelled = po.status === "Cancelled" || po.currentStage === "Cancelled";
  const isClosed = po.status === "Closed" || po.currentStage === "Closed";
  const canEdit = isApproved && !isCancelled;
  const canCancel = isApproved && !isCancelled;
  const canManualClose = isApproved && !isCancelled && user.role === "FinanceHead" && onCloseManually;
  const pendingEdits = pos.filter(p => p.type === "POEdit" && p.editingPOId === po.id && !["Approved", "Rejected", "Cancelled"].includes(p.status));
  const statusColor = isApproved ? "emerald" : isCancelled ? "slate" : isClosed ? "slate" : po.status === "Rejected" ? "red" : "amber";

  return (
    <div className={`bg-white rounded-xl border ${isCancelled ? "border-slate-200 opacity-75" : "border-fuchsia-200"}`}>
      {viewAttachment && <AttachmentViewer attachment={viewAttachment} onClose={() => setViewAttachment(null)} />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-fuchsia-100 text-fuchsia-700"><FileSignature className="w-3 h-3 inline mr-0.5" />PO</span>
              {po.poNumber && <span className="font-mono text-xs font-bold text-fuchsia-900">{po.poNumber}</span>}
              {po.version > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100">v{po.version}</span>}
              <span className={`text-xs px-2 py-0.5 rounded font-semibold bg-${statusColor}-100 text-${statusColor}-700`}>{po.status}</span>
              {po.isProject ? <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">Project</span> : <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">Non-Project</span>}
              {pendingEdits.length > 0 && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold"><Edit3 className="w-3 h-3 inline mr-0.5" />Edit Pending</span>}
            </div>
            <div className="font-semibold text-slate-900 text-sm">{po.supplierName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {po.isProject ? `Project: ${po.projectId}` : `${po.dept} · ${po.category}`}
              {" · "}By <strong>{po.requesterName}</strong>
              {" · "}{new Date(po.createdDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">₹{(po.amountINR / 100000).toFixed(2)}L</div>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1 mt-0.5 ml-auto"><Eye className="w-3 h-3" />{expanded ? "Hide" : "View"}</button>
          </div>
        </div>

        {isApproved && !isCancelled && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Paid</div><div className="font-bold">₹{(usage.paid / 100000).toFixed(2)}L</div></div>
            <div className="bg-amber-50 rounded p-2"><div className="text-amber-700">Committed</div><div className="font-bold">₹{(usage.committed / 100000).toFixed(2)}L</div></div>
            <div className="bg-blue-50 rounded p-2"><div className="text-blue-700">Available</div><div className="font-bold">₹{(available / 100000).toFixed(2)}L</div></div>
          </div>
        )}

        {(canEdit || canCancel || canManualClose) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {canEdit && <button onClick={onEdit} className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />Request Edit</button>}
            {canCancel && <button onClick={onCancel} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" />Request Cancel</button>}
            {canManualClose && <button onClick={onCloseManually} className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" />Close PO</button>}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div>
              <div className="font-bold text-slate-700 mb-1">Supplier</div>
              <div>{po.supplierName}</div>
              <div>{po.supplierAddress}</div>
              {po.isInternational ? (
                <>
                  <div>Country: <strong>{po.supplierCountry}</strong> <span className="text-slate-500">(International)</span></div>
                  {po.supplierTaxId && <div>Tax ID: <span className="font-mono">{po.supplierTaxId}</span></div>}
                </>
              ) : (
                po.supplierGST && <div>GSTIN: <span className="font-mono">{po.supplierGST}</span></div>
              )}
            </div>

            {po.lineItems && po.lineItems.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1">Line Items ({po.lineItems.length})</div>
                <div className="overflow-x-auto bg-slate-50 rounded-lg p-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-600 font-semibold">
                        <th className="p-1">#</th><th className="p-1">Description</th><th className="p-1 text-right">Qty</th><th className="p-1">Unit</th><th className="p-1 text-right">Unit Cost</th><th className="p-1 text-right">GST%</th><th className="p-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.lineItems.map((li, idx) => {
                        const sub = parseFloat(li.qty || 0) * parseFloat(li.unitCost || 0);
                        const gst = sub * (parseFloat(li.gstPct || 0) / 100);
                        return (
                          <tr key={li.id || idx} className="border-t border-slate-200">
                            <td className="p-1">{idx + 1}</td>
                            <td className="p-1">{li.description}</td>
                            <td className="p-1 text-right">{li.qty}</td>
                            <td className="p-1">{li.unit}</td>
                            <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{parseFloat(li.unitCost || 0).toLocaleString("en-IN")}</td>
                            <td className="p-1 text-right">{li.gstPct}%</td>
                            <td className="p-1 text-right font-semibold">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(sub + gst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-white">
                        <td colSpan={6} className="p-1 text-right font-semibold">Subtotal:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(po.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-white">
                        <td colSpan={6} className="p-1 text-right font-semibold">GST:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(po.totalGST || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-fuchsia-100 font-bold">
                        <td colSpan={6} className="p-1 text-right">Grand Total:</td>
                        <td className="p-1 text-right">{(CURRENCIES.find(c => c.code === po.currency)?.symbol || "₹")}{(po.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {po.currency !== "INR" && <div className="text-xs text-slate-500 mt-1">≈ ₹{(po.amountINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} @ ₹{po.fxRate}/{po.currency}</div>}
              </div>
            )}

            <div><div className="font-bold text-slate-700 mb-1">Scope Summary</div><div className="whitespace-pre-wrap">{po.scope}</div></div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">Delivery:</span> {po.deliveryTimeline}</div>
              <div><span className="text-slate-500">Terms:</span> {po.paymentTerms}</div>
            </div>
            {po.attachment && <div><span className="text-slate-500">Quote:</span> <button onClick={() => setViewAttachment(po.attachment)} className="text-fuchsia-700 underline font-medium inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{po.attachment.name}</button></div>}
            {linkedReqs.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1">Linked Payments ({linkedReqs.length})</div>
                <div className="space-y-1">
                  {linkedReqs.map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-slate-50 rounded p-1.5">
                      <span className="font-mono">{r.id}</span>
                      <span>{r.requesterName}</span>
                      <span className="font-semibold">₹{(r.amountINR / 100000).toFixed(2)}L</span>
                      <span className="text-slate-500">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {po.editHistory && po.editHistory.length > 0 && (
              <div>
                <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><History className="w-3 h-3" />Edit History</div>
                <div className="space-y-1">
                  {po.editHistory.map((eh, i) => (
                    <div key={i} className="bg-slate-50 rounded p-2">
                      <div className="font-semibold">v{eh.version} · {new Date(eh.at).toLocaleString("en-IN", { day: "numeric", month: "short" })}</div>
                      <div className="text-slate-600">By {eh.by}</div>
                      <div className="italic">"{eh.changeNote}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="font-bold text-slate-700 mb-1">Approval History</div>
              <div className="space-y-1">
                {(po.history || []).map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${h.action.includes("Reject") ? "bg-red-100 text-red-600" : "bg-fuchsia-100 text-fuchsia-600"}`}>
                      {h.action.includes("Reject") ? <XCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{h.action}</div>
                      <div className="text-slate-600">By {h.by} · {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      {h.comments && <div className="text-slate-500 italic">"{h.comments}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function POCancelModal({ po, user, pos, savePOs, onClose, showToast }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const cancelReq = {
      id: "POCANCEL-" + Date.now(), kind: "PO", type: "POCancel",
      cancellingPOId: po.id, cancellingPONumber: po.poNumber,
      createdDate: now, requesterId: user.id, requesterName: user.name, dept: user.dept,
      isProject: po.isProject, projectId: po.projectId, supplierName: po.supplierName,
      amount: 0, amountINR: 0, currency: "INR", fxRate: 1, reason,
      currentStage: "FinanceHead", status: "Pending Finance Head",
      selectedApprovers: [],
      history: [{ action: "Cancellation Requested", by: user.name, byId: user.id, at: now, comments: reason }],
    };
    await savePOs([cancelReq, ...pos]);
    setBusy(false);
    showToast("Cancellation request sent to Finance Head", "success");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3"><Ban className="w-5 h-5 text-red-600" /><div className="font-bold">Cancel PO {po.poNumber}</div></div>
        <p className="text-sm text-slate-600 mb-3">Goes to Finance Head for approval. Once cancelled, no new payments can be raised.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (mandatory)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <div className="flex gap-2 mt-3">
          <button onClick={submit} disabled={busy || !reason.trim()} className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg">Submit Cancellation</button>
          <button onClick={onClose} className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg">Nevermind</button>
        </div>
      </div>
    </div>
  );
}

// ============ REPORTS VIEW ============
function ReportsView({ user, requests, budgets, pos }) {
  const [section, setSection] = useState("budget");
  const activeProjBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));
  const activeMonthlyBudgets = budgets.filter(b => b.type === "Monthly" && (b.status === "Active" || b.currentStage === "Active"));
  const activeExtensions = budgets.filter(b => b.type === "Extension" && (b.status === "Active" || b.currentStage === "Active"));
  const paidReqs = requests.filter(r => r.status === "Paid");
  const clientProjects = activeProjBudgets.filter(b => b.projectType === "Client");
  const rdProjects = activeProjBudgets.filter(b => b.projectType === "RD");
  const rdPaid = paidReqs.filter(r => rdProjects.some(p => p.projectId === r.projectId)).reduce((s, r) => s + (r.amountINR || r.amount), 0);

  function groupSum(list, keyFn, valFn = r => r.amountINR || r.amount) {
    const out = {};
    list.forEach(r => { const k = keyFn(r); if (k) out[k] = (out[k] || 0) + valFn(r); });
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setSection("budget")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === "budget" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><PiggyBank className="w-4 h-4 inline mr-1" />Approved Budgets</button>
        <button onClick={() => setSection("expense")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === "expense" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><Wallet className="w-4 h-4 inline mr-1" />Expenses (Paid)</button>
        <button onClick={() => setSection("pnl")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === "pnl" ? "bg-amber-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}><TrendingUp className="w-4 h-4 inline mr-1" />Project P&L</button>
      </div>

      {section === "budget" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-3">Active Project Budgets</h3>
            {[...clientProjects, ...rdProjects].length === 0 && <div className="text-sm text-slate-500">None</div>}
            {[...clientProjects, ...rdProjects].map(b => (
              <div key={b.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold mr-2 ${b.projectType === "RD" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-blue-100 text-blue-700"}`}>{b.projectType === "RD" ? "R&D" : "CLIENT"}</span>
                  <span className="font-mono text-xs">{b.projectId}</span>
                  <span className="ml-2">{b.projectName}</span>
                </div>
                <span className="font-bold">₹{(b.amountINR / 100000).toFixed(2)}L</span>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">By Department</h3>
              {groupSum(activeProjBudgets, b => b.dept).map(([d, v]) => <div key={d} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{d}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">Monthly Budgets by Category</h3>
              {groupSum(activeMonthlyBudgets, b => b.category).map(([c, v]) => <div key={c} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{c}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
          </div>
          {activeExtensions.length > 0 && <div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><h3 className="font-bold text-amber-900 text-sm">Extensions: {activeExtensions.length} totaling ₹{(activeExtensions.reduce((s, e) => s + e.amountINR, 0) / 100000).toFixed(2)}L</h3></div>}
        </div>
      )}

      {section === "expense" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <div className="text-sm text-emerald-700">Total Paid</div>
            <div className="text-3xl font-bold text-emerald-900">₹{(paidReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0) / 100000).toFixed(2)}L</div>
            <div className="text-xs text-emerald-600 mt-1">{paidReqs.length} payment{paidReqs.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">By Department</h3>
              {groupSum(paidReqs, r => r.dept).length === 0 ? <div className="text-sm text-slate-500">None</div> : groupSum(paidReqs, r => r.dept).map(([d, v]) => <div key={d} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{d}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900 mb-3">By Category</h3>
              {groupSum(paidReqs, r => r.expenseTypeName).length === 0 ? <div className="text-sm text-slate-500">None</div> : groupSum(paidReqs, r => r.expenseTypeName).map(([c, v]) => <div key={c} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><span>{c}</span><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-3">By Project</h3>
            {groupSum(paidReqs.filter(r => r.projectId), r => r.projectId).length === 0 ? <div className="text-sm text-slate-500">None</div> : groupSum(paidReqs.filter(r => r.projectId), r => r.projectId).map(([p, v]) => {
              const budget = activeProjBudgets.find(b => b.projectId === p);
              return <div key={p} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"><div><span className="font-mono text-xs">{p}</span>{budget && <span className="ml-2">{budget.projectName}</span>}</div><span className="font-bold">₹{(v / 100000).toFixed(2)}L</span></div>;
            })}
          </div>
        </div>
      )}

      {section === "pnl" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-1">Client Project P&L</h3>
            <p className="text-xs text-slate-500 mb-3">P&L = Client Order − Total Paid Expenses</p>
            {clientProjects.length === 0 ? <div className="text-sm text-slate-500 py-4">No active client projects.</div> : (
              <div className="space-y-2">
                {clientProjects.map(b => {
                  const projPaid = paidReqs.filter(r => r.projectId === b.projectId).reduce((s, r) => s + (r.amountINR || r.amount), 0);
                  const projCommitted = requests.filter(r => r.projectId === b.projectId && !["Paid", "Rejected", "Cancelled"].includes(r.status)).reduce((s, r) => s + (r.amountINR || r.amount), 0);
                  const profit = b.clientOrderValue - projPaid;
                  const margin = b.clientOrderValue > 0 ? (profit / b.clientOrderValue) * 100 : 0;
                  return (
                    <div key={b.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                        <div>
                          <div className="font-bold">{b.projectName}</div>
                          <div className="text-xs font-mono text-slate-500">{b.projectId}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${margin >= 20 ? "bg-emerald-100 text-emerald-700" : margin >= 10 ? "bg-amber-100 text-amber-700" : margin >= 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>{margin >= 0 ? "+" : ""}{margin.toFixed(1)}% margin</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white rounded p-2"><div className="text-slate-500">Client Order</div><div className="font-bold">₹{(b.clientOrderValue / 100000).toFixed(2)}L</div></div>
                        <div className="bg-white rounded p-2"><div className="text-slate-500">Budget</div><div className="font-bold">₹{(b.amountINR / 100000).toFixed(2)}L</div></div>
                        <div className="bg-white rounded p-2"><div className="text-slate-500">Paid</div><div className="font-bold text-emerald-700">₹{(projPaid / 100000).toFixed(2)}L</div></div>
                        <div className={`rounded p-2 ${profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}><div className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>P&L</div><div className={`font-bold ${profit >= 0 ? "text-emerald-900" : "text-red-900"}`}>₹{(profit / 100000).toFixed(2)}L</div></div>
                      </div>
                      {projCommitted > 0 && <div className="text-xs text-amber-700 mt-2">⚠ +₹{(projCommitted / 100000).toFixed(2)}L committed</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {rdProjects.length > 0 && (
            <div className="bg-fuchsia-50 rounded-xl border border-fuchsia-200 p-4">
              <h3 className="font-bold text-fuchsia-900 mb-1">R&D Cost Center</h3>
              <p className="text-xs text-fuchsia-700 mb-3">No client revenue. Pure internal cost.</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded p-2"><div className="text-fuchsia-700 text-xs">Active Budgets</div><div className="font-bold text-fuchsia-900">₹{(rdProjects.reduce((s, p) => s + p.amountINR, 0) / 100000).toFixed(2)}L</div></div>
                <div className="bg-white rounded p-2"><div className="text-fuchsia-700 text-xs">Paid (Cost)</div><div className="font-bold text-fuchsia-900">₹{(rdPaid / 100000).toFixed(2)}L</div></div>
                <div className="bg-white rounded p-2"><div className="text-fuchsia-700 text-xs">Projects</div><div className="font-bold text-fuchsia-900">{rdProjects.length}</div></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ ORG OVERVIEW ============
function OrgOverview({ user, requests, budgets, pos, showToast }) {
  const [drillDown, setDrillDown] = useState(null);
  const visibleRequests = filterByAccess(user, requests);
  const visibleBudgets = filterByAccess(user, budgets);
  const visiblePOs = pos ? filterByAccess(user, pos) : [];

  const total = visibleRequests.length;
  const paidReqs = visibleRequests.filter(r => r.status === "Paid");
  const pendingReqs = visibleRequests.filter(r => !["Paid", "Rejected", "Cancelled"].includes(r.status));
  const totalPaidINR = paidReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);
  const totalPendingINR = pendingReqs.reduce((s, r) => s + (r.amountINR || r.amount), 0);

  const clientBudgets = visibleBudgets.filter(b => b.type === "Project" && b.projectType === "Client" && (b.status === "Active" || b.currentStage === "Active"));
  const rdBudgets = visibleBudgets.filter(b => b.type === "Project" && b.projectType === "RD" && (b.status === "Active" || b.currentStage === "Active"));
  const allActiveBudgets = [...clientBudgets, ...rdBudgets];
  const activeClientBudget = clientBudgets.reduce((s, b) => s + b.amountINR, 0);
  const activeRDBudget = rdBudgets.reduce((s, b) => s + b.amountINR, 0);

  const byDept = {};
  visibleRequests.filter(r => r.status === "Paid").forEach(r => { byDept[r.dept] = (byDept[r.dept] || 0) + (r.amountINR || r.amount); });

  function handleCardClick(data, title) {
    if (data.length === 0) { showToast("Nothing here", "info"); return; }
    setDrillDown({ title, data });
  }

  return (
    <div>
      <StatCards items={[
        { label: "Total Payment Reqs", value: total, color: "blue", icon: FileText, onClick: () => handleCardClick(visibleRequests, "All Payments") },
        { label: "Paid (INR)", value: "₹" + (totalPaidINR / 100000).toFixed(1) + "L", color: "emerald", icon: CheckCircle2, onClick: () => handleCardClick(paidReqs, "Paid") },
        { label: "Pending (INR)", value: "₹" + (totalPendingINR / 100000).toFixed(1) + "L", color: "amber", icon: Clock, onClick: () => handleCardClick(pendingReqs, "Pending") },
        { label: "Active Budgets", value: "₹" + ((activeClientBudget + activeRDBudget) / 100000).toFixed(0) + "L", color: "indigo", icon: PiggyBank, onClick: () => handleCardClick(allActiveBudgets, "Active Budgets") },
      ]} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-1">Spend by Department (Paid only)</h3>
          <p className="text-xs text-slate-500 mb-3">Counts only paid amounts. Approved budgets and pending requests are excluded.</p>
          {Object.keys(byDept).length === 0 ? <p className="text-sm text-slate-500">No paid requests yet.</p> : (
            <div className="space-y-2">
              {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([d, amt]) => {
                const deptPaid = visibleRequests.filter(r => r.dept === d && r.status === "Paid");
                return (
                  <button key={d} onClick={() => handleCardClick(deptPaid, `${d} — Paid`)} className="w-full flex justify-between items-center text-sm hover:bg-slate-50 p-1 rounded">
                    <span className="font-medium">{d}</span>
                    <span className="font-bold">₹{(amt / 100000).toFixed(2)}L</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3">Project Margins (Client)</h3>
          {clientBudgets.length === 0 ? <p className="text-sm text-slate-500">None</p> : (
            <div className="space-y-2 text-sm">
              {clientBudgets.map(b => {
                const margin = ((b.clientOrderValue - b.amountINR) / b.clientOrderValue) * 100;
                return <div key={b.id} className="flex justify-between"><span className="text-xs font-mono truncate pr-2">{b.projectId}</span><span className={`font-bold ${margin >= 20 ? "text-emerald-700" : margin >= 10 ? "text-amber-700" : "text-red-700"}`}>{margin.toFixed(1)}%</span></div>;
              })}
            </div>
          )}
        </div>
      </div>

      {drillDown && <DrillDownModal title={drillDown.title} items={drillDown.data} user={user} requests_all={requests} budgets_all={budgets} pos_all={visiblePOs} onClose={() => setDrillDown(null)} />}
    </div>
  );
}

function TabBar({ tabs, active, setActive }) {
  return (
    <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${active === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            <Icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${t.highlight ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function StatCards({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {items.map((s, i) => {
        const Icon = s.icon;
        const clickable = !!s.onClick;
        return (
          <button key={i} onClick={s.onClick} disabled={!clickable} className={`bg-white rounded-xl p-4 border border-slate-200 text-left transition ${clickable ? "hover:border-blue-400 hover:shadow-md cursor-pointer" : "cursor-default"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{s.label}</div>
              <div className={`w-7 h-7 rounded-lg bg-${s.color}-100 text-${s.color}-600 flex items-center justify-center`}><Icon className="w-3.5 h-3.5" /></div>
            </div>
            <div className="text-xl font-bold text-slate-900">{s.value}</div>
            {clickable && <div className="text-xs text-blue-600 mt-1 font-medium">Click to view →</div>}
          </button>
        );
      })}
    </div>
  );
}