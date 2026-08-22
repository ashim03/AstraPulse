import {
  LayoutDashboard,
  BarChart3,
  Users,
  Building2,
  CalendarCheck,
  CalendarDays,
  PartyPopper,
  ListTodo,
  Clock3,
  HandCoins,
  Wallet,
  Receipt,
  TrendingUp,
  BookOpenCheck,
  FileText,
  CreditCard,
  LineChart,
  Megaphone,
  Mail,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
  badge?: number;
};

export const NAVIGATION: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Leave", href: "/leave", icon: CalendarDays },
  { label: "Holidays", href: "/holidays", icon: PartyPopper },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Work Records", href: "/work-records", icon: Clock3 },
  { label: "Employee Advances", href: "/advances", icon: HandCoins },
  { label: "Payroll", href: "/payroll", icon: Wallet },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Income", href: "/income", icon: TrendingUp },
  { label: "Accounting", href: "/accounting", icon: BookOpenCheck },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Financial Reports", href: "/reports", icon: LineChart },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Internal Mail", href: "/mail", icon: Mail },
  { label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const NAV_SECTIONS: Record<string, { label: string; items: string[] }> = {
  Overview: { label: "Overview", items: ["Dashboard", "Analytics"] },
  "People & HR": {
    label: "People & HR",
    items: ["Staff", "Departments", "Attendance", "Leave", "Holidays", "Tasks", "Work Records", "Employee Advances"],
  },
  "Finance & Accounting": {
    label: "Finance & Accounting",
    items: ["Payroll", "Expenses", "Income", "Accounting", "Invoices", "Payments", "Financial Reports"],
  },
  Company: {
    label: "Company",
    items: ["Announcements", "Internal Mail", "Audit Logs", "Settings"],
  },
};

export const APP_NAME = "AstraPulse";

export const PLANS = [
  {
    name: "Starter",
    price: 49,
    monthly: 49,
    yearly: 490,
    employeeLimit: 15,
    features: ["Up to 15 employees", "Core HR & attendance", "Leave management", "Basic payroll", "Email support"],
  },
  {
    name: "Growth",
    price: 99,
    monthly: 99,
    yearly: 990,
    employeeLimit: 100,
    features: ["Up to 100 employees", "Advanced payroll & tax", "Invoicing & payments", "Accounting & reports", "Priority support"],
  },
  {
    name: "Pro",
    price: 199,
    monthly: 199,
    yearly: 1990,
    employeeLimit: 500,
    features: ["Unlimited employees", "Everything in Growth", "Multi-currency", "API access", "Dedicated support manager"],
  },
];

export const CURRENCIES = ["NPR", "USD", "EUR", "GBP", "INR", "AED", "CAD", "AUD", "SGD", "BDT"];
export const TIMEZONES = [
  "Asia/Kathmandu",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Kathmandu",
  "Asia/Singapore",
  "Australia/Sydney",
];
export const BUSINESS_TYPES = [
  "Technology",
  "Retail",
  "Manufacturing",
  "Professional Services",
  "Healthcare",
  "Education",
  "Hospitality",
  "Finance",
  "Logistics",
  "Other",
];
export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Bangladesh",
  "United Arab Emirates",
  "Singapore",
  "Germany",
  "France",
];

export type BadgeTone =
  | "gray"
  | "blue"
  | "indigo"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "sky"
  | "rose"
  | "orange";

export const STATUS_TONE: Record<string, BadgeTone> = {
  active: "green",
  inactive: "gray",
  pending: "amber",
  approved: "green",
  rejected: "red",
  draft: "gray",
  processing: "blue",
  completed: "green",
  paid: "green",
  unpaid: "amber",
  overdue: "red",
  cancelled: "gray",
  archived: "gray",
  published: "green",
  sent: "blue",
  viewed: "sky",
  partial: "amber",
  partially_paid: "amber",
  reviewed: "indigo",
  submitted: "blue",
  in_progress: "blue",
  todo: "sky",
  review: "violet",
  backlog: "gray",
  calculated: "indigo",
  process: "blue",
  locked: "violet",
  posted: "green",
  on_leave: "amber",
  terminated: "red",
  important: "amber",
  urgent: "red",
  normal: "gray",
  read: "gray",
  unread: "indigo",
  paid_pending: "amber",
  approved_pending: "amber",
};

export function toneFor(status: string): BadgeTone {
  return STATUS_TONE[status.toLowerCase().replace(/ /g, "_")] ?? "gray";
}

export const ROLE_DEFS = [
  {
    name: "Super Admin",
    description: "Full access to everything including billing and system settings.",
    isSystem: true,
    permissions: "*",
  },
  {
    name: "Workspace Admin",
    description: "Manage workspace, staff, approvals and subscriptions.",
    isSystem: true,
    permissions: "*",
  },
  {
    name: "HR Manager",
    description: "Manage employees, attendance, leave and documents.",
    isSystem: true,
    permissions: ["staff", "departments", "attendance", "leave", "holidays", "tasks", "work-records", "advances", "documents", "announcements", "payroll"],
  },
  {
    name: "Accountant",
    description: "Manage accounting, expenses, income, invoices and reports.",
    isSystem: true,
    permissions: ["accounting", "expenses", "income", "invoices", "payments", "reports", "banks"],
  },
  {
    name: "Payroll Manager",
    description: "Manage payroll processing and employee advances.",
    isSystem: true,
    permissions: ["payroll", "advances", "salary-components", "reports"],
  },
  {
    name: "Manager",
    description: "Approve leave and work records for their team.",
    isSystem: true,
    permissions: ["tasks", "work-records", "leave", "attendance"],
  },
  {
    name: "Employee",
    description: "Self-service: attendance, leave requests and timesheets.",
    isSystem: true,
    permissions: ["attendance", "leave", "work-records", "tasks"],
  },
];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "manage"] as const;

export const MODULES = [
  "dashboard",
  "analytics",
  "staff",
  "departments",
  "attendance",
  "leave",
  "holidays",
  "tasks",
  "work-records",
  "advances",
  "payroll",
  "expenses",
  "income",
  "accounting",
  "invoices",
  "payments",
  "reports",
  "announcements",
  "mail",
  "audit-logs",
  "settings",
  "subscription",
  "documents",
];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern", "probation"] as const;

export const DEFAULT_LEAVE_TYPES = [
  { name: "Annual Leave", daysPerYear: 15, carryForward: true, color: "#6366f1" },
  { name: "Sick Leave", daysPerYear: 10, carryForward: false, color: "#ef4444" },
  { name: "Casual Leave", daysPerYear: 8, carryForward: false, color: "#f59e0b" },
  { name: "Maternity Leave", daysPerYear: 90, carryForward: false, color: "#ec4899" },
  { name: "Paternity Leave", daysPerYear: 14, carryForward: false, color: "#06b6d4" },
  { name: "Unpaid Leave", daysPerYear: 0, carryForward: false, color: "#6b7280" },
];

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1010", name: "Checking Account", type: "asset" },
  { code: "1020", name: "Savings Account", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1200", name: "Inventory", type: "asset" },
  { code: "1300", name: "Prepaid Expenses", type: "asset" },
  { code: "1500", name: "Equipment", type: "asset" },
  { code: "1510", name: "Accumulated Depreciation", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Accrued Salaries & Wages", type: "liability" },
  { code: "2110", name: "Payroll Taxes Payable", type: "liability" },
  { code: "2120", name: "Employee Advances Payable", type: "liability" },
  { code: "2200", name: "Sales Tax Payable", type: "liability" },
  { code: "2300", name: "Short-term Loans", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3100", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "4100", name: "Service Revenue", type: "revenue" },
  { code: "4200", name: "Interest Income", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Salaries Expense", type: "expense" },
  { code: "5110", name: "Payroll Taxes Expense", type: "expense" },
  { code: "5200", name: "Rent Expense", type: "expense" },
  { code: "5210", name: "Utilities Expense", type: "expense" },
  { code: "5220", name: "Office Supplies", type: "expense" },
  { code: "5230", name: "Software & Subscriptions", type: "expense" },
  { code: "5240", name: "Marketing Expense", type: "expense" },
  { code: "5250", name: "Travel & Meals", type: "expense" },
  { code: "5260", name: "Equipment & Depreciation", type: "expense" },
  { code: "5270", name: "Insurance Expense", type: "expense" },
  { code: "5280", name: "Professional Fees", type: "expense" },
  { code: "5290", name: "Bank Charges", type: "expense" },
  { code: "5300", name: "Miscellaneous Expense", type: "expense" },
];

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Office Supplies",
  "Software",
  "Marketing",
  "Transportation",
  "Utilities",
  "Equipment",
  "Training",
  "Other",
];

export const INCOME_CATEGORIES = ["Product Sales", "Service Revenue", "Subscription", "Consulting", "Interest", "Other"];

export const PAYMENT_METHODS = ["Bank Transfer", "Credit Card", "Cash", "Check", "Mobile Payment", "QR Code"];

export const TASK_STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "completed", label: "Completed" },
];

export const TASK_PRIORITIES = [
  { value: "low", label: "Low", tone: "sky" },
  { value: "medium", label: "Medium", tone: "amber" },
  { value: "high", label: "High", tone: "orange" },
  { value: "urgent", label: "Urgent", tone: "red" },
];

export const LEAVE_STATUSES = ["draft", "pending", "approved", "rejected", "cancelled"];

export const WORKFLOW_LEAVE = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export const EXPENSE_STATUSES = ["draft", "submitted", "approved", "rejected", "paid"];

export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export const PAYROLL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "calculated", label: "Calculated" },
  { value: "approved", label: "Approved" },
  { value: "processed", label: "Processed" },
  { value: "paid", label: "Paid" },
  { value: "locked", label: "Locked" },
];

export const REPORTS = [
  { value: "profit-loss", label: "Profit & Loss" },
  { value: "balance-sheet", label: "Balance Sheet" },
  { value: "cash-flow", label: "Cash Flow" },
  { value: "trial-balance", label: "Trial Balance" },
  { value: "general-ledger", label: "General Ledger" },
  { value: "accounts-receivable", label: "Accounts Receivable" },
  { value: "accounts-payable", label: "Accounts Payable" },
  { value: "expense-report", label: "Expense Report" },
  { value: "revenue-report", label: "Revenue Report" },
  { value: "payroll-cost", label: "Payroll Cost Report" },
  { value: "tax-summary", label: "Tax Summary" },
];

export const REPORT_PERIODS = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "all", label: "All Time" },
];

export const ANNOUNCEMENT_AUDIENCES = ["all", "department", "role"];
export const ANNOUNCEMENT_PRIORITIES = [
  { value: "normal", label: "Normal", tone: "gray" },
  { value: "important", label: "Important", tone: "amber" },
  { value: "urgent", label: "Urgent", tone: "red" },
];

export const NOTIFICATION_TYPES = {
  info: "indigo",
  success: "green",
  warning: "amber",
  error: "red",
} as const;

export const CHART_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

export const SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "cancelled", "expired"];

export const EMAIL_VERIFICATION_REQUIRED = false;