import { hashPassword } from "../src/lib/auth";
import { DEFAULT_LEAVE_TYPES, DEFAULT_CHART_OF_ACCOUNTS, ROLE_DEFS } from "../src/lib/constants";
import {
  ACCOUNT_OPENING,
  DEPARTMENTS,
  EMPLOYEES,
  POSITIONS,
  PASSWORD,
} from "./seed-data";
import type { SeedContext } from "./seed-context";
import { subDays } from "date-fns";
import { PrismaClient } from "@prisma/client";

export async function wipe(prisma: PrismaClient) {
  const order = [
    "taskComment",
    "messageRecipient",
    "message",
    "notification",
    "auditLog",
    "journalLine",
    "journalEntry",
    "payrollItem",
    "payroll",
    "invoiceItem",
    "invoice",
    "payment",
    "expense",
    "income",
    "document",
    "salaryComponent",
    "attendanceAdjustment",
    "attendance",
    "workRecord",
    "employeeAdvance",
    "leaveRequest",
    "leaveType",
    "holiday",
    "task",
    "paymentRequest",
    "subscription",
    "bankAccount",
    "account",
    "customer",
    "vendor",
    "employee",
    "position",
    "department",
    "user",
    "role",
    "workspace",
  ];
  for (const model of order) {
    const key = model.charAt(0).toUpperCase() + model.slice(1);
    await (prisma as unknown as Record<string, { deleteMany: (args?: unknown) => Promise<unknown> }>)[key].deleteMany({});
  }
}

export async function seedBase(ctx: SeedContext): Promise<void> {
  const { prisma, now } = ctx;
  const passwordHash = hashPassword(PASSWORD);

  // Roles
  for (const r of ROLE_DEFS) {
    const role = await prisma.role.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: r.name,
        description: r.description,
        isSystem: true,
        permissions: Array.isArray(r.permissions)
          ? JSON.stringify(
              r.permissions.flatMap((m: string) =>
                ["view", "create", "edit", "delete", "approve", "export", "manage"].map((a) => `${m}:${a}`)
              )
            )
          : JSON.stringify(["*"]),
      },
    });
    ctx.roles[r.name] = role.id;
  }

  // Users
  ctx.admin = await prisma.user.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: "Aisha Rahman",
      email: "admin@nova.local",
      passwordHash,
      roleId: ctx.roles["Workspace Admin"],
      phone: "+1 212 555 0101",
      status: "active",
    },
  });
  ctx.userIds["admin@nova.local"] = ctx.admin.id;

  const demoUsers = [
    { name: "Sarah Mitchell", email: "hr@nova.local", role: "HR Manager" },
    { name: "Omar Faruk", email: "accountant@nova.local", role: "Accountant" },
    { name: "Emma Wilson", email: "payroll@nova.local", role: "Payroll Manager" },
    { name: "Liam O'Brien", email: "manager@nova.local", role: "Manager" },
    { name: "Marcus Lee", email: "employee@nova.local", role: "Employee" },
  ];
  for (const u of demoUsers) {
    const user = await prisma.user.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: ctx.roles[u.role],
        status: "active",
      },
    });
    ctx.userIds[u.email] = user.id;
  }

  // Departments & positions
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.create({
      data: { workspaceId: ctx.workspace.id, name: d.name, description: d.description },
    });
    ctx.deptIds[d.name] = dept.id;
  }
  for (const [dept, pos] of POSITIONS) {
    const p = await prisma.position.create({
      data: { workspaceId: ctx.workspace.id, departmentId: ctx.deptIds[dept], name: pos },
    });
    ctx.positionIds[pos] = p.id;
  }

  // Employees
  const managerByName: Record<string, string> = {};
  for (const e of EMPLOYEES) {
    const emp = await prisma.employee.create({
      data: {
        workspaceId: ctx.workspace.id,
        employeeId: e.id as string,
        name: e.name as string,
        email: e.email as string,
        phone: e.phone as string,
        departmentId: ctx.deptIds[e.dept as string],
        positionId: ctx.positionIds[e.position as string],
        employmentType: e.type as string,
        joinDate: subDays(now, e.joinOffset as number),
        contractEndDate: e.id === "EMP-014" ? new Date(now.getTime() + 18 * 86400000) : undefined,
        status: e.status as string,
        workLocation: e.city === "Remote" ? "Remote" : (e.city as string),
        baseSalary: e.salary as number,
        paymentMethod: "Bank Transfer",
        bankName: "First National Bank",
        bankAccountNumber: `****${String(8000 + ((e.joinOffset as number) % 1000)).padStart(4, "0")}`,
        accountHolder: e.name as string,
        taxId: `US-${String(100000 + (e.joinOffset as number))}`,
        dateOfBirth: subDays(now, e.dobOffset as number),
        gender: e.gender as string,
        city: e.city as string,
        country: "United States",
        address: `${100 + ((e.joinOffset as number) % 900)} Main Street`,
        emergencyName: e.gender === "F" ? "Michael Carter" : "Jennifer Lewis",
        emergencyPhone: "+1 917 555 0199",
        emergencyRelation: "Spouse",
        createdBy: ctx.admin.id,
      },
    });
    ctx.employeeIds[e.id as string] = emp.id;
    managerByName[e.name as string] = emp.id;

    const components: Array<{ type: string; name: string; amount: number; effectiveFrom: Date }> = [
      { type: "allowance", name: "Housing Allowance", amount: 250, effectiveFrom: emp.joinDate },
      { type: "allowance", name: "Transport Allowance", amount: 120, effectiveFrom: emp.joinDate },
      { type: "deduction", name: "Health Insurance", amount: 180, effectiveFrom: emp.joinDate },
    ];
    if ((e.salary as number) > 15000) {
      components.push({ type: "bonus", name: "Executive Bonus", amount: 1200, effectiveFrom: emp.joinDate });
    }
    await prisma.salaryComponent.createMany({
      data: components.map((c) => ({ workspaceId: ctx.workspace.id, employeeId: emp.id, ...c })),
    });
  }

  // Department managers + reporting
  const deptManager: Record<string, string> = {
    Executive: "Aisha Rahman",
    "Human Resources": "Sarah Mitchell",
    "Finance & Accounting": "Omar Faruk",
    Sales: "Emma Wilson",
    Engineering: "Liam O'Brien",
    Marketing: "Priya Patel",
    "Operations & Support": "Grace Okafor",
  };
  for (const [dept, mgr] of Object.entries(deptManager)) {
    await prisma.department.update({
      where: { id: ctx.deptIds[dept] },
      data: { managerId: managerByName[mgr] },
    });
  }
  for (const e of EMPLOYEES) {
    if (e.position === "Chief Executive Officer") continue;
    const mgrName = e.dept === "Executive" ? "Aisha Rahman" : deptManager[e.dept as string];
    if (mgrName && mgrName !== e.name) {
      await prisma.employee.update({
        where: { id: ctx.employeeIds[e.id as string] },
        data: { managerId: managerByName[mgrName] },
      });
    }
  }

  // Link user accounts to employees
  const linkMap: Array<[string, string]> = [
    ["hr@nova.local", "EMP-003"],
    ["accountant@nova.local", "EMP-004"],
    ["payroll@nova.local", "EMP-005"],
    ["manager@nova.local", "EMP-006"],
    ["employee@nova.local", "EMP-010"],
    ["admin@nova.local", "EMP-001"],
  ];
  for (const [email, empId] of linkMap) {
    await prisma.user.update({
      where: { id: ctx.userIds[email] },
      data: { employeeId: ctx.employeeIds[empId] },
    });
  }

  // Chart of accounts
  for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
    const acc = await prisma.account.create({
      data: {
        workspaceId: ctx.workspace.id,
        code: a.code,
        name: a.name,
        type: a.type,
        openingBalance: ACCOUNT_OPENING[a.code] ?? 0,
        balance: ACCOUNT_OPENING[a.code] ?? 0,
        status: "active",
        isSystem: true,
      },
    });
    ctx.accountIds[a.code] = acc.id;
  }

  // Bank accounts
  ctx.checking = await prisma.bankAccount.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: "Business Checking",
      bank: "First National Bank",
      accountNumber: "FN-4412-9981",
      currency: "USD",
      openingBalance: 25000,
      currentBalance: 25000,
    },
  });
  ctx.savings = await prisma.bankAccount.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: "Savings Reserve",
      bank: "First National Bank",
      accountNumber: "FN-4477-5520",
      currency: "USD",
      openingBalance: 40000,
      currentBalance: 40000,
    },
  });

  // Leave types
  for (const lt of DEFAULT_LEAVE_TYPES) {
    const type = await prisma.leaveType.create({ data: { workspaceId: ctx.workspace.id, ...lt } });
    ctx.leaveTypeIds[lt.name] = type.id;
  }
}