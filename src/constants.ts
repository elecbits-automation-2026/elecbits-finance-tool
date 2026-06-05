// ============ USER DATABASE ============
export const USERS = [
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
export const VP_THRESHOLD = 100000;
export const CEO_THRESHOLD = 500000;
export const PROFIT_MARGIN = 0.20;
export const MAX_BUDGET_RATIO = 0.80;
export const RD_MONTHLY_CAP = 200000;
export const NON_PROJECT_DEPTS = ["HR", "Finance", "Product+Marketing"];

export const CURRENCIES = [
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

export const EXPENSE_TYPES = [
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

export const SEED_BUDGETS = [
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

export const SEED_POS = [
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

export const STORAGE_KEY_REQUESTS = "elecbits_fos_requests_v3";
export const STORAGE_KEY_BUDGETS = "elecbits_fos_budgets_v4";
export const STORAGE_KEY_NOTIFS = "elecbits_fos_notifs_v1";
export const STORAGE_KEY_POS = "elecbits_fos_pos_v3";
export const STORAGE_KEY_PO_COUNTER = "elecbits_fos_po_counter_v3";
export const STORAGE_KEY_USERS = "elecbits_fos_users_v1";
export const STORAGE_KEY_ADMIN = "elecbits_fos_admin_v1";
export const STORAGE_KEY_PENDING = "elecbits_fos_pending_signups_v1";

// ============ ADMIN ============
// The dedicated org-administrator account. Logs in by typing the bare username
// "admin" (mapped to this email in signIn) with password admin@123. Its profile
// uses role "Admin" and routes to the standalone Admin Console, not the finance
// dashboard. Provisioned by `npm run seed` (scripts/seed.ts).
export const ADMIN_EMAIL = "admin@elecbits.in";

// ============ ROLES (admin-assignable) ============
export const ASSIGNABLE_ROLES = [
  { id: "Employee", label: "Employee" },
  { id: "DeptApprover", label: "Department Head" },
  { id: "BoxBuildMidApprover", label: "Box Build Delivery Head" },
  { id: "Accountant", label: "Accountant" },
  { id: "FinanceHead", label: "Finance Head" },
  { id: "SuperManager", label: "Manager (Special Access)" },
  { id: "VP", label: "Vice President" },
  { id: "CEO", label: "CEO" },
];

export const DEPARTMENTS = [
  "Executive", "Management", "Finance", "HR", "ODM", "Box Build", "Sales", "Product+Marketing", "Other",
];

// GSTIN regex (15 chars, Indian format)
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{4}[0-9A-Z]{1}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const GST_RATES = [0, 5, 12, 18, 28];
export const UNIT_OPTIONS = ["pcs", "kg", "hours", "services", "units", "mtr", "sets", "lot", "other"];
