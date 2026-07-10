// ============ CONFIG ============
export const VP_THRESHOLD = 100000;
export const CEO_THRESHOLD = 500000;
export const PROFIT_MARGIN = 0.20;
export const MAX_BUDGET_RATIO = 0.80;
export const RD_MONTHLY_CAP = 200000;
export const NON_PROJECT_DEPTS = ["HR", "Finance", "Product", "Marketing"];

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
  { id: "PC-PROJ", name: "Project Consultant Fee", category: "Non-Project" },
  { id: "TR", name: "Travel", category: "Non-Project", pool: "Travel & Accommodation" },
  { id: "AC", name: "Accommodation", category: "Non-Project", pool: "Travel & Accommodation" },
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

// Travel-flow expense types. Travel and Accommodation are picked separately in the
// Raise Payment dropdown (so spend is clearly categorised) but both draw from a
// single shared "Travel & Accommodation" monthly pool. Selecting either reveals the
// travel-specific fields (dates, urgency, travellers) inline in the payment form.
export const TRAVEL_POOL = "Travel & Accommodation";
export const TRAVEL_EXPENSE_IDS = ["TR", "AC"];
// Accommodation per-night spend cap by the raiser's role (INR). Total stay must be
// within cap × nights. Employee tier (Employee / read-only / Accountant) uses the
// default; the head roles are the "manager" tier.
export const ACCOMMODATION_DAILY_CAP_DEFAULT = 3000;
export const ACCOMMODATION_DAILY_CAP_BY_ROLE = {
  DeptApprover: 5000,
  BoxBuildMidApprover: 5000,
  FinanceHead: 5000,
  SuperManager: 7000, // "Special Access"
  VP: 7000,
  CEO: 11000,
};
export const accommodationDailyCap = (role) => ACCOMMODATION_DAILY_CAP_BY_ROLE[role] ?? ACCOMMODATION_DAILY_CAP_DEFAULT;

// Expense categories the HR channel sees org-wide (people + office/admin ops). Keep
// in sync with the requests_select RLS carve-out (migration 0027 / caller_in_hr).
export const HR_EXPENSE_NAMES = [
  "Travel",
  "Accommodation",
  "Salary & Payroll",
  "Employee Reimbursements",
  "Office Supplies",
  "Marketing Events",
  "Utilities & Office Expenses",
];
// Minimum lead time (days) before travel start; a shorter lead requires an
// urgency justification.
export const TRAVEL_MIN_LEAD_DAYS = 4;
// The monthly-budget "category" (pool) a non-project expense draws from. Travel and
// Accommodation share one pool; every other type pools to its own name.
export const expensePoolName = (name) => (EXPENSE_TYPES.find(t => t.name === name)?.pool) || name;
// Distinct monthly-budget categories a Dept Head can raise (one per pool), so the
// budget form offers a single "Travel & Accommodation" option, not two.
export const MONTHLY_BUDGET_CATEGORIES = [...new Set(EXPENSE_TYPES.filter(t => t.category === "Non-Project").map(t => t.pool || t.name))];

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
  "Executive", "Management", "Finance", "HR", "ODM", "Box Build", "Sales", "Product", "Marketing", "Other",
];

// GSTIN regex (15 chars, Indian format)
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{4}[0-9A-Z]{1}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Indian states / UTs with their GST state code (the first two digits of a GSTIN).
// Used to validate that a client's GSTIN matches their selected state.
export const INDIAN_STATES = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];
export const GST_RATES = [0, 5, 12, 18, 28];
export const UNIT_OPTIONS = ["pcs", "kg", "hours", "services", "units", "mtr", "sets", "lot", "other"];
