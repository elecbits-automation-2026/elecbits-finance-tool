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
