export const PASSWORD = "Admin@123";

export const DEPARTMENTS = [
  { name: "Executive", description: "Company leadership and strategy" },
  { name: "Human Resources", description: "People operations and culture" },
  { name: "Finance & Accounting", description: "Financial control and reporting" },
  { name: "Sales", description: "Revenue generation and accounts" },
  { name: "Engineering", description: "Product and platform development" },
  { name: "Marketing", description: "Brand, growth and communications" },
  { name: "Operations & Support", description: "Delivery, logistics and customer support" },
];

export const EMPLOYEES: Array<Record<string, unknown>> = [
  { id: "EMP-001", name: "Aisha Rahman", email: "aisha.rahman@nova.local", phone: "+1 212 555 0101", dept: "Executive", position: "Chief Executive Officer", salary: 18000, joinOffset: 950, status: "active", type: "full_time", city: "New York", gender: "F", dobOffset: 13000 },
  { id: "EMP-002", name: "Daniel Chen", email: "daniel.chen@nova.local", phone: "+1 212 555 0102", dept: "Executive", position: "Chief Operating Officer", salary: 16500, joinOffset: 900, status: "active", type: "full_time", city: "New York", gender: "M", dobOffset: 11500 },
  { id: "EMP-003", name: "Sarah Mitchell", email: "sarah.mitchell@nova.local", phone: "+1 212 555 0103", dept: "Human Resources", position: "HR Manager", salary: 8500, joinOffset: 720, status: "active", type: "full_time", city: "New York", gender: "F", dobOffset: 10500 },
  { id: "EMP-004", name: "Omar Faruk", email: "omar.faruk@nova.local", phone: "+1 212 555 0104", dept: "Finance & Accounting", position: "Finance Manager", salary: 8800, joinOffset: 690, status: "active", type: "full_time", city: "New York", gender: "M", dobOffset: 9900 },
  { id: "EMP-005", name: "Emma Wilson", email: "emma.wilson@nova.local", phone: "+1 212 555 0105", dept: "Sales", position: "Head of Sales", salary: 8200, joinOffset: 610, status: "active", type: "full_time", city: "Chicago", gender: "F", dobOffset: 10800 },
  { id: "EMP-006", name: "Liam O'Brien", email: "liam.obrien@nova.local", phone: "+1 212 555 0106", dept: "Engineering", position: "Engineering Lead", salary: 9800, joinOffset: 560, status: "active", type: "full_time", city: "Austin", gender: "M", dobOffset: 9600 },
  { id: "EMP-007", name: "Sofia Ramirez", email: "sofia.ramirez@nova.local", phone: "+1 212 555 0107", dept: "Finance & Accounting", position: "Senior Accountant", salary: 7200, joinOffset: 420, status: "active", type: "full_time", city: "New York", gender: "F", dobOffset: 8200 },
  { id: "EMP-008", name: "Noah Kim", email: "noah.kim@nova.local", phone: "+1 212 555 0108", dept: "Engineering", position: "Product Manager", salary: 7600, joinOffset: 390, status: "active", type: "full_time", city: "Seattle", gender: "M", dobOffset: 8800 },
  { id: "EMP-009", name: "Priya Patel", email: "priya.patel@nova.local", phone: "+1 212 555 0109", dept: "Marketing", position: "Marketing Manager", salary: 6900, joinOffset: 350, status: "active", type: "full_time", city: "New York", gender: "F", dobOffset: 7600 },
  { id: "EMP-010", name: "Marcus Lee", email: "marcus.lee@nova.local", phone: "+1 212 555 0110", dept: "Sales", position: "Sales Executive", salary: 5200, joinOffset: 300, status: "active", type: "full_time", city: "Denver", gender: "M", dobOffset: 6100 },
  { id: "EMP-011", name: "Hana Suzuki", email: "hana.suzuki@nova.local", phone: "+1 212 555 0111", dept: "Engineering", position: "Frontend Developer", salary: 6800, joinOffset: 240, status: "active", type: "full_time", city: "Remote", gender: "F", dobOffset: 6900 },
  { id: "EMP-012", name: "Tomás Silva", email: "tomas.silva@nova.local", phone: "+1 212 555 0112", dept: "Engineering", position: "Backend Developer", salary: 7100, joinOffset: 220, status: "active", type: "full_time", city: "Remote", gender: "M", dobOffset: 6400 },
  { id: "EMP-013", name: "Grace Okafor", email: "grace.okafor@nova.local", phone: "+1 212 555 0113", dept: "Operations & Support", position: "Support Lead", salary: 4600, joinOffset: 180, status: "active", type: "full_time", city: "Boston", gender: "F", dobOffset: 5200 },
  { id: "EMP-014", name: "Jacob Miller", email: "jacob.miller@nova.local", phone: "+1 212 555 0114", dept: "Operations & Support", position: "Operations Analyst", salary: 4300, joinOffset: 120, status: "on_leave", type: "full_time", city: "Boston", gender: "M", dobOffset: 4700 },
  { id: "EMP-015", name: "Lily Zhang", email: "lily.zhang@nova.local", phone: "+1 212 555 0115", dept: "Human Resources", position: "HR Coordinator", salary: 4100, joinOffset: 60, status: "active", type: "part_time", city: "New York", gender: "F", dobOffset: 3900 },
];

export const POSITIONS: Array<[string, string]> = [
  ["Executive", "Chief Executive Officer"],
  ["Executive", "Chief Operating Officer"],
  ["Human Resources", "HR Manager"],
  ["Human Resources", "HR Coordinator"],
  ["Finance & Accounting", "Finance Manager"],
  ["Finance & Accounting", "Senior Accountant"],
  ["Sales", "Head of Sales"],
  ["Sales", "Sales Executive"],
  ["Engineering", "Engineering Lead"],
  ["Engineering", "Product Manager"],
  ["Engineering", "Frontend Developer"],
  ["Engineering", "Backend Developer"],
  ["Marketing", "Marketing Manager"],
  ["Marketing", "Marketing Specialist"],
  ["Operations & Support", "Support Lead"],
  ["Operations & Support", "Operations Analyst"],
];

export const CUSTOMERS = [
  { name: "BlueSky Technologies", email: "billing@bluesky.tech", phone: "+1 415 555 0141", address: "500 Market St, San Francisco, CA" },
  { name: "GreenLeaf Organics", email: "ap@greenleaf.com", phone: "+1 206 555 0142", address: "88 Pike St, Seattle, WA" },
  { name: "Harbor Logistics", email: "finance@harborlog.com", phone: "+1 617 555 0143", address: "12 Harbor Ave, Boston, MA" },
  { name: "Metro Fitness", email: "accounts@metrofitness.io", phone: "+1 312 555 0144", address: "221 W Adams St, Chicago, IL" },
  { name: "Summit Consulting", email: "payments@summitc.io", phone: "+1 303 555 0145", address: "1776 Broadway, Denver, CO" },
];

export const VENDORS = [
  { name: "Office Supplies Direct", email: "billing@osd.com", phone: "+1 800 555 0181", address: "9 Supply Row, Newark, NJ" },
  { name: "CloudWorks SaaS", email: "invoices@cloudworks.io", phone: "+1 800 555 0182", address: "55 Cloud St, Austin, TX" },
  { name: "Skyline Airlines", email: "billing@skyline.aero", phone: "+1 800 555 0183", address: "100 Terminal Dr, Dallas, TX" },
  { name: "WeWork Co-working", email: "ap@wework.com", phone: "+1 212 555 0184", address: "115 Broadway, New York, NY" },
];

export const HOLIDAYS: Array<{ name: string; dayOffset: number }> = [
  { name: "New Year's Day", dayOffset: -5 },
  { name: "Memorial Day", dayOffset: -70 },
  { name: "Independence Day", dayOffset: -45 },
  { name: "Labor Day", dayOffset: -10 },
  { name: "Thanksgiving", dayOffset: 60 },
  { name: "Christmas Day", dayOffset: 120 },
];

export const LEAVE_REQUEST_SEED = [
  { emp: "EMP-009", type: "Annual Leave", startOffset: -12, days: 3, status: "approved", reason: "Family vacation" },
  { emp: "EMP-010", type: "Annual Leave", startOffset: 2, days: 5, status: "pending", reason: "Honeymoon travel" },
  { emp: "EMP-014", type: "Sick Leave", startOffset: -4, days: 2, status: "approved", reason: "Flu recovery" },
  { emp: "EMP-015", type: "Casual Leave", startOffset: -2, days: 1, status: "cancelled", reason: "Personal appointment moved" },
  { emp: "EMP-011", type: "Annual Leave", startOffset: 10, days: 4, status: "pending", reason: "Trip to Japan" },
  { emp: "EMP-007", type: "Unpaid Leave", startOffset: -20, days: 2, status: "rejected", reason: "Extended personal leave" },
  { emp: "EMP-013", type: "Sick Leave", startOffset: -6, days: 1, status: "approved", reason: "Migraine" },
  { emp: "EMP-003", type: "Maternity Leave", startOffset: -35, days: 30, status: "approved", reason: "Maternity" },
];

export const TASK_SEED = [
  { title: "Launch Q3 marketing campaign", desc: "Coordinate email, social and paid channels for the Q3 campaign.", assignee: "EMP-009", dept: "Marketing", priority: "high", status: "in_progress", dueOffset: 5, labels: ["Marketing", "Q3"] },
  { title: "Implement payroll auto-deductions", desc: "Connect employee advances to payroll deduction automatically.", assignee: "EMP-004", dept: "Finance & Accounting", priority: "urgent", status: "review", dueOffset: 2, labels: ["Finance", "Payroll"] },
  { title: "Onboard 3 new sales hires", desc: "Prepare onboarding materials and schedule training.", assignee: "EMP-003", dept: "Human Resources", priority: "medium", status: "todo", dueOffset: 9, labels: ["HR", "Onboarding"] },
  { title: "Fix checkout latency bug", desc: "Investigate slow checkout under load and deploy fix.", assignee: "EMP-012", dept: "Engineering", priority: "urgent", status: "in_progress", dueOffset: 1, labels: ["Engineering", "Bug"] },
  { title: "Redesign invoice PDF template", desc: "Improve print layout and add payment QR code.", assignee: "EMP-011", dept: "Engineering", priority: "medium", status: "backlog", dueOffset: 14, labels: ["Design"] },
  { title: "Quarterly employee engagement survey", desc: "Prepare and distribute the Q3 pulse survey.", assignee: "EMP-015", dept: "Human Resources", priority: "low", status: "completed", dueOffset: -3, labels: ["HR"] },
  { title: "Renew office lease", desc: "Negotiate renewal terms with the landlord.", assignee: "EMP-002", dept: "Executive", priority: "high", status: "todo", dueOffset: 20, labels: ["Ops"] },
  { title: "Update accounting chart of accounts", desc: "Add tax clearing account and split revenue categories.", assignee: "EMP-007", dept: "Finance & Accounting", priority: "medium", status: "completed", dueOffset: -6, labels: ["Finance", "Accounting"] },
  { title: "Customer success playbook", desc: "Document support workflows and escalation paths.", assignee: "EMP-013", dept: "Operations & Support", priority: "medium", status: "in_progress", dueOffset: 7, labels: ["CS"] },
  { title: "Prepare annual budget draft", desc: "Compile department budgets for the next fiscal year.", assignee: "EMP-004", dept: "Finance & Accounting", priority: "high", status: "backlog", dueOffset: 30, labels: ["Finance"] },
];

export const WORK_RECORD_SEED = [
  { emp: "EMP-012", project: "Checkout Optimization", daysAgo: 1, hours: 8, billable: true, desc: "Optimized DB queries and added caching layer.", status: "approved" },
  { emp: "EMP-011", project: "Invoice Template Redesign", daysAgo: 2, hours: 6, billable: true, desc: "Built new PDF layout in Figma and coded the print view.", status: "approved" },
  { emp: "EMP-010", project: "Q3 Sales Outreach", daysAgo: 1, hours: 7.5, billable: true, desc: "Follow-ups with 12 enterprise prospects.", status: "approved" },
  { emp: "EMP-009", project: "Q3 Campaign", daysAgo: 3, hours: 5, billable: false, desc: "Wrote email copy and set up automation.", status: "pending" },
  { emp: "EMP-013", project: "Support Escalation", daysAgo: 2, hours: 8, billable: true, desc: "Resolved 34 support tickets, escalated 3.", status: "approved" },
  { emp: "EMP-007", project: "Month-end Close", daysAgo: 1, hours: 7, billable: true, desc: "Reconciled bank accounts and posted accruals.", status: "pending" },
  { emp: "EMP-004", project: "Payroll Automation", daysAgo: 1, hours: 6, billable: true, desc: "Documented advance deduction workflow.", status: "approved" },
  { emp: "EMP-006", project: "Platform Architecture", daysAgo: 2, hours: 8, billable: true, desc: "Reviewed service boundaries and migrations.", status: "approved" },
  { emp: "EMP-015", project: "Onboarding Program", daysAgo: 1, hours: 4, billable: false, desc: "Scheduled training sessions for new hires.", status: "pending" },
];

export const ADVANCE_SEED = [
  { emp: "EMP-003", amount: 2000, daysAgo: 40, months: 4, reason: "Home renovation", status: "approved" },
  { emp: "EMP-005", amount: 1500, daysAgo: 30, months: 3, reason: "Medical expenses", status: "approved" },
  { emp: "EMP-010", amount: 800, daysAgo: 5, months: 2, reason: "Travel advance", status: "pending" },
  { emp: "EMP-013", amount: 600, daysAgo: 15, months: 2, reason: "Course fees", status: "rejected" },
];

export const INVOICE_SEED = [
  { cust: "BlueSky Technologies", items: [{ d: "Enterprise license (annual)", qty: 1, price: 24000 }], daysAgo: 40, dueDays: 30, status: "paid", paidAmount: 26400, taxRate: 0.1 },
  { cust: "GreenLeaf Organics", items: [{ d: "Implementation services", qty: 40, price: 150 }], daysAgo: 32, dueDays: 30, status: "paid", paidAmount: 6600, taxRate: 0.1 },
  { cust: "Harbor Logistics", items: [{ d: "Platform subscription - 12 seats", qty: 12, price: 180 }], daysAgo: 25, dueDays: 30, status: "sent", paidAmount: 0, taxRate: 0.1 },
  { cust: "Metro Fitness", items: [{ d: "Consulting retainer", qty: 1, price: 5000 }, { d: "Expense reimbursements", qty: 1, price: 1200 }], daysAgo: 18, dueDays: 30, status: "viewed", paidAmount: 0, taxRate: 0.08 },
  { cust: "Summit Consulting", items: [{ d: "Professional services", qty: 25, price: 220 }], daysAgo: 48, dueDays: 30, status: "overdue", paidAmount: 0, taxRate: 0.08 },
  { cust: "BlueSky Technologies", items: [{ d: "Support retainer (Q3)", qty: 1, price: 3000 }], daysAgo: 10, dueDays: 30, status: "partially_paid", paidAmount: 1650, taxRate: 0.1 },
  { cust: "Metro Fitness", items: [{ d: "Annual maintenance", qty: 1, price: 4500 }], daysAgo: 3, dueDays: 30, status: "draft", paidAmount: 0, taxRate: 0.08 },
];

export const PAYMENT_IN_SEED = [
  { ref: "PMT-9001", cust: "BlueSky Technologies", amount: 26400, daysAgo: 12, invKey: "BlueSky Technologies-1001", method: "Bank Transfer" },
  { ref: "PMT-9002", cust: "GreenLeaf Organics", amount: 6600, daysAgo: 20, invKey: "GreenLeaf Organics-1002", method: "Bank Transfer" },
  { ref: "PMT-9003", cust: "BlueSky Technologies", amount: 1650, daysAgo: 4, invKey: "BlueSky Technologies-1006", method: "Credit Card" },
  { ref: "PMT-9004", cust: "Summit Consulting", amount: 550, daysAgo: 2, invKey: null, method: "Credit Card" },
];

export const EXPENSE_SEED = [
  { vendor: "Office Supplies Direct", cat: "Office Supplies", amount: 480, daysAgo: 3, status: "submitted", method: "Credit Card", acc: "5220", desc: "Printer toner and paper" },
  { vendor: "CloudWorks SaaS", cat: "Software", amount: 1280, daysAgo: 8, status: "approved", method: "Credit Card", acc: "5230", desc: "Dev tools subscription - Q3" },
  { vendor: "Skyline Airlines", cat: "Travel", amount: 1650, daysAgo: 6, status: "submitted", method: "Credit Card", acc: "5250", desc: "Sales team flights to Denver" },
  { vendor: "WeWork Co-working", cat: "Utilities", amount: 3400, daysAgo: 12, status: "paid", method: "Bank Transfer", acc: "5200", desc: "Monthly office rent" },
  { vendor: "Office Supplies Direct", cat: "Meals", amount: 260, daysAgo: 2, status: "draft", method: "Cash", acc: "5250", desc: "Client lunch meeting" },
  { vendor: "CloudWorks SaaS", cat: "Software", amount: 2100, daysAgo: 15, status: "paid", method: "Bank Transfer", acc: "5230", desc: "Marketing automation annual" },
  { vendor: "Skyline Airlines", cat: "Travel", amount: 920, daysAgo: 20, status: "rejected", method: "Credit Card", acc: "5250", desc: "Conference registration" },
  { vendor: "WeWork Co-working", cat: "Utilities", amount: 610, daysAgo: 25, status: "paid", method: "Bank Transfer", acc: "5210", desc: "Electricity bill" },
  { vendor: "Office Supplies Direct", cat: "Office Supplies", amount: 320, daysAgo: 28, status: "paid", method: "Credit Card", acc: "5220", desc: "Office supplies restock" },
];

export const INCOME_SEED = [
  { cust: "Summit Consulting", cat: "Consulting", amount: 4200, daysAgo: 5, method: "Bank Transfer", acc: "4100", desc: "Advisory consulting retainer" },
  { cust: "Metro Fitness", cat: "Subscription", amount: 2160, daysAgo: 11, method: "Credit Card", acc: "4100", desc: "Monthly SaaS subscription" },
  { cust: "GreenLeaf Organics", cat: "Service Revenue", amount: 1800, daysAgo: 16, method: "Bank Transfer", acc: "4100", desc: "Training workshop" },
  { cust: "BlueSky Technologies", cat: "Product Sales", amount: 3200, daysAgo: 22, method: "Bank Transfer", acc: "4000", desc: "Hardware bundle sale" },
  { cust: "Harbor Logistics", cat: "Consulting", amount: 950, daysAgo: 27, method: "Credit Card", acc: "4100", desc: "Quarterly optimization review" },
];

export const PAYMENT_OUT_SEED = [
  { ref: "PMT-9101", vendor: "WeWork Co-working", amount: 3400, daysAgo: 12, method: "Bank Transfer" },
  { ref: "PMT-9102", vendor: "CloudWorks SaaS", amount: 2100, daysAgo: 15, method: "Bank Transfer" },
  { ref: "PMT-9103", vendor: "WeWork Co-working", amount: 610, daysAgo: 25, method: "Bank Transfer" },
  { ref: "PMT-9104", vendor: "Office Supplies Direct", amount: 320, daysAgo: 28, method: "Credit Card" },
];

export const ANNOUNCEMENT_SEED = [
  { title: "Welcome to the new quarter!", message: "A warm welcome to Q3. Remember to submit your timesheets every Friday and keep leave requests approved before travel.", audience: "all", priority: "normal", status: "published", publishOffset: -3, expiryOffset: 25 },
  { title: "Health insurance open enrollment", message: "Open enrollment for health insurance runs through the end of this month. Please review your plans and submit changes to HR.", audience: "department", dept: "Human Resources", priority: "important", status: "published", publishOffset: -2, expiryOffset: 18 },
  { title: "Office holiday closure", message: "The office will be closed on the last Friday of the month for maintenance.", audience: "all", priority: "normal", status: "draft", publishOffset: 6, expiryOffset: 12 },
];

export const ACCOUNT_OPENING: Record<string, number> = {
  "1000": 5000,
  "1010": 25000,
  "1020": 40000,
  "1500": 120000,
  "1510": -15000,
  "2000": 8000,
  "2300": 50000,
  "3000": 100000,
  "3100": 57000,
};