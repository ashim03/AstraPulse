import { PrismaClient } from "@prisma/client";
import { seedBase, wipe } from "./seed-base";
import { seedFinance, seedOps, seedSubscription } from "./seed-ops";
import type { SeedContext } from "./seed-context";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing existing data...");
  await wipe(prisma);

  const now = new Date();

  const workspace = await prisma.workspace.create({
    data: {
      name: "Nova Retail Group",
      email: "admin@nova.local",
      slug: "nova-retail-group",
      phone: "+1 212 555 0100",
      country: "United States",
      currency: "NPR",
      timezone: "America/New_York",
      businessType: "Retail",
      status: "active",
    },
  });

  const ctx: SeedContext = {
    prisma,
    now,
    workspace,
    admin: {} as never,
    userIds: {},
    roles: {},
    deptIds: {},
    positionIds: {},
    employeeIds: {},
    accountIds: {},
    customerIds: {},
    vendorIds: {},
    leaveTypeIds: {},
    checking: {} as never,
    savings: {} as never,
  };

  console.log("Workspace created:", workspace.name);
  console.log("Seeding base (roles, users, departments, employees, accounts)...");
  await seedBase(ctx);

  console.log("Seeding operations (attendance, leave, tasks, work records, advances)...");
  await seedOps(ctx);

  console.log("Seeding finance (payroll, invoices, payments, expenses, income, journals)...");
  await seedFinance(ctx);

  console.log("Seeding subscription...");
  await seedSubscription(ctx);

  const counts = {
    employees: await prisma.employee.count({ where: { workspaceId: workspace.id } }),
    attendance: await prisma.attendance.count({ where: { workspaceId: workspace.id } }),
    leaveRequests: await prisma.leaveRequest.count({ where: { workspaceId: workspace.id } }),
    tasks: await prisma.task.count({ where: { workspaceId: workspace.id } }),
    payrolls: await prisma.payroll.count({ where: { workspaceId: workspace.id } }),
    invoices: await prisma.invoice.count({ where: { workspaceId: workspace.id } }),
    payments: await prisma.payment.count({ where: { workspaceId: workspace.id } }),
    journalEntries: await prisma.journalEntry.count({ where: { workspaceId: workspace.id } }),
    accounts: await prisma.account.count({ where: { workspaceId: workspace.id } }),
  };

  console.log("\n=== Seed complete ===");
  console.table(counts);
  console.log("\nDemo logins (password: Admin@123):");
  console.log("  superadmin@astrapulse.com - Super Admin");
  console.log("  admin@nova.local        - Workspace Admin");
  console.log("  hr@nova.local           - HR Manager");
  console.log("  accountant@nova.local   - Accountant");
  console.log("  payroll@nova.local      - Payroll Manager");
  console.log("  manager@nova.local      - Manager");
  console.log("  employee@nova.local     - Employee");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });