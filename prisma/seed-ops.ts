import {
  addDays,
  subDays,
} from "date-fns";
import { buildPayrollRun } from "../src/services/payroll";
import {
  CUSTOMERS,
  VENDORS,
  HOLIDAYS,
  INVOICE_SEED,
  PAYMENT_IN_SEED,
  EXPENSE_SEED,
  INCOME_SEED,
  PAYMENT_OUT_SEED,
} from "./seed-data";
import type { SeedContext } from "./seed-context";
import { dayAt } from "./seed-context";

export async function seedOps(ctx: SeedContext): Promise<void> {
  const { prisma, now } = ctx;

  // Holidays
  for (const h of HOLIDAYS) {
    if (h.dayOffset >= -70) {
      await prisma.holiday.create({
        data: {
          workspaceId: ctx.workspace.id,
          name: h.name,
          date: addDays(now, h.dayOffset),
          recurring: true,
        },
      });
    }
  }

  // Attendance over the last 30 working days
  for (let i = 29; i >= 0; i--) {
    const day = subDays(now, i);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    for (const e of EMPLOYEES) {
      if (e.status !== "active") continue;
      const empId = e.id as string;
      const seed = (empId.charCodeAt(empId.length - 1) + i) % 100;
      let status = "present";
      if (seed < 5) status = "absent";
      else if (seed < 12) status = "late";
      else if (seed < 18) status = "remote";
      else if (seed < 22) status = "early";
      if (status === "absent") continue;

      const isLate = status === "late";
      const clockIn = isLate ? dayAt(day, 9, 30 + (seed % 20)) : dayAt(day, 8, 50 + (seed % 15));
      const overtimeHours = e.dept === "Engineering" && seed % 4 === 0 ? 1.5 : 0;
      const clockOutBase = dayAt(day, 17, 30 - (seed % 40));
      const clockOut = new Date(clockOutBase.getTime() + overtimeHours * 3600000);
      const hours = status === "early" ? 6.5 : 8;

      await prisma.attendance.create({
        data: {
          workspaceId: ctx.workspace.id,
          employeeId: ctx.employeeIds[empId],
          date: dayAt(day, 0, 0),
          clockIn,
          clockOut,
          status,
          hours: status === "remote" ? hours : hours + (isLate ? -0.25 : 0),
          overtime: overtimeHours,
          breakMinutes: 45,
          location: status === "remote" ? "Remote" : (e.city as string),
          source: i === 0 ? "self" : "manual",
        },
      });
    }
  }

  // Leave requests
  for (const r of LEAVE_REQUEST_SEED) {
    const start = r.startOffset >= 0 ? addDays(now, r.startOffset) : subDays(now, Math.abs(r.startOffset));
    await prisma.leaveRequest.create({
      data: {
        workspaceId: ctx.workspace.id,
        employeeId: ctx.employeeIds[r.emp],
        typeId: ctx.leaveTypeIds[r.type],
        startDate: dayAt(start, 0, 0),
        endDate: dayAt(addDays(start, r.days - 1), 0, 0),
        days: r.days,
        reason: r.reason,
        status: r.status,
        approverId: r.status === "approved" ? ctx.admin.id : null,
        approvedAt: r.status === "approved" ? subDays(now, 2) : null,
        createdAt: subDays(now, 4),
      },
    });
  }

  // Tasks
  for (const t of TASK_SEED) {
    const task = await prisma.task.create({
      data: {
        workspaceId: ctx.workspace.id,
        title: t.title,
        description: t.desc,
        assigneeId: ctx.employeeIds[t.assignee],
        departmentId: ctx.deptIds[t.dept],
        priority: t.priority,
        status: t.status,
        dueDate: addDays(now, t.dueOffset),
        labels: JSON.stringify(t.labels),
        createdBy: ctx.admin.id,
        createdAt: subDays(now, 10),
      },
    });
    if (t.title === "Fix checkout latency bug") {
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: ctx.userIds["manager@nova.local"],
          content: "Reproduced on staging; likely a DB connection pool issue.",
        },
      });
    }
  }

  // Work records
  for (const w of WORK_RECORD_SEED) {
    await prisma.workRecord.create({
      data: {
        workspaceId: ctx.workspace.id,
        employeeId: ctx.employeeIds[w.emp],
        project: w.project,
        date: dayAt(subDays(now, w.daysAgo), 0, 0),
        startTime: "09:00",
        endTime: "17:00",
        hours: w.hours,
        description: w.desc,
        billable: w.billable,
        status: w.status,
        approvedBy: w.status === "approved" ? ctx.admin.id : null,
        approvedAt: w.status === "approved" ? subDays(now, 0) : null,
      },
    });
  }

  // Advances
  for (const a of ADVANCE_SEED) {
    const installment = a.amount / a.months;
    const outstanding = a.status === "approved" ? a.amount - installment : 0;
    await prisma.employeeAdvance.create({
      data: {
        workspaceId: ctx.workspace.id,
        employeeId: ctx.employeeIds[a.emp],
        amount: a.amount,
        date: dayAt(subDays(now, a.daysAgo), 0, 0),
        reason: a.reason,
        months: a.months,
        installment,
        outstanding,
        status: a.status,
        approvedBy: a.status === "approved" ? ctx.admin.id : null,
        approvedAt: a.status === "approved" ? subDays(now, a.daysAgo - 5) : null,
      },
    });
  }

  // Announcements
  for (const a of ANNOUNCEMENT_SEED) {
    await prisma.announcement.create({
      data: {
        workspaceId: ctx.workspace.id,
        title: a.title,
        message: a.message,
        audience: a.audience,
        departmentId: a.dept ? ctx.deptIds[a.dept] : null,
        priority: a.priority,
        publishDate: a.publishOffset >= 0 ? addDays(now, a.publishOffset) : subDays(now, Math.abs(a.publishOffset)),
        expiryDate: addDays(now, a.expiryOffset),
        status: a.status,
        authorId: ctx.admin.id,
      },
    });
  }

  // Messages
  await prisma.message.create({
    data: {
      workspaceId: ctx.workspace.id,
      senderId: ctx.userIds["hr@nova.local"],
      subject: "Updated attendance policy",
      body: "Hi everyone,\n\nWe've updated the attendance policy to allow up to 2 remote days per week with manager approval. Please review the updated policy.\n\nBest,\nSarah",
      createdAt: subDays(now, 1),
      recipients: { create: [{ recipientId: ctx.admin.id }] },
    },
  });
  await prisma.message.create({
    data: {
      workspaceId: ctx.workspace.id,
      senderId: ctx.userIds["accountant@nova.local"],
      subject: "July close is complete",
      body: "The month-end close for the previous month is complete. All accounts are reconciled and financial reports are ready for review.",
      createdAt: subDays(now, 2),
      recipients: {
        create: [{ recipientId: ctx.admin.id }, { recipientId: ctx.userIds["payroll@nova.local"] }],
      },
    },
  });
  await prisma.message.create({
    data: {
      workspaceId: ctx.workspace.id,
      senderId: ctx.admin.id,
      subject: "Welcome to AstraPulse",
      body: "Welcome aboard! Explore the dashboard, add your team and run your first payroll.",
      createdAt: subDays(now, 6),
      recipients: { create: [{ recipientId: ctx.userIds["employee@nova.local"] }] },
    },
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      { workspaceId: ctx.workspace.id, userId: ctx.admin.id, title: "2 leave requests awaiting approval", body: "Marcus Lee and Hana Suzuki have submitted leave requests.", type: "warning", link: "/leave" },
      { workspaceId: ctx.workspace.id, userId: ctx.admin.id, title: "Payroll is ready to review", body: "The current payroll period is ready for review and approval.", type: "info", link: "/payroll" },
      { workspaceId: ctx.workspace.id, userId: ctx.admin.id, title: "Invoice INV-1005 is overdue", body: "Summit Consulting has an overdue invoice of $5,940.", type: "error", link: "/invoices" },
      { workspaceId: ctx.workspace.id, userId: ctx.userIds["hr@nova.local"], title: "Contract ending soon", body: "Jacob Miller's contract ends in 18 days.", type: "warning", link: "/staff" },
    ],
  });

  // Audit logs
  const auditSeeds = [
    { action: "create", module: "staff", recordId: ctx.employeeIds["EMP-015"], description: "Employee created - Lily Zhang (HR Coordinator)" },
    { action: "update", module: "staff", recordId: ctx.employeeIds["EMP-007"], description: "Employee salary updated - Sofia Ramirez" },
    { action: "approve", module: "leave", description: "Admin approved leave request - Priya Patel (Annual Leave)" },
    { action: "approve", module: "leave", description: "Admin approved leave request - Sarah Mitchell (Maternity Leave)" },
    { action: "process", module: "payroll", description: `Payroll processed for ${ctx.workspace.name}` },
    { action: "create", module: "expenses", description: "Expense submitted - Skyline Airlines travel claim" },
    { action: "approve", module: "expenses", description: "Expense approved - WeWork monthly office rent" },
    { action: "create", module: "invoices", description: "Invoice INV-1007 raised to Metro Fitness" },
    { action: "create", module: "payments", description: "Payment received PMT-9001 from BlueSky Technologies ($26,400)" },
    { action: "login", module: "auth", description: "Admin signed in" },
    { action: "create", module: "accounting", description: "Journal entry posted - Payroll journal" },
    { action: "update", module: "staff", recordId: ctx.employeeIds["EMP-001"], description: "Employee updated - Aisha Rahman (contact details)" },
  ];
  for (const a of auditSeeds) {
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: ctx.admin.id,
        action: a.action,
        module: a.module,
        recordId: a.recordId,
        description: a.description,
        createdAt: subDays(now, Math.floor(Math.random() * 10)),
      },
    });
  }

  // Documents
  await prisma.document.createMany({
    data: [
      { workspaceId: ctx.workspace.id, entityType: "employee", entityId: ctx.employeeIds["EMP-003"], name: "Employment Contract 2025.pdf", filePath: "/docs/contract-sarah.pdf", type: "application/pdf", size: 245000, expiresAt: addDays(now, 45), uploadedBy: ctx.admin.id },
      { workspaceId: ctx.workspace.id, entityType: "employee", entityId: ctx.employeeIds["EMP-010"], name: "Passport Scan.pdf", filePath: "/docs/passport-marcus.pdf", type: "application/pdf", size: 180000, expiresAt: addDays(now, 30), uploadedBy: ctx.admin.id },
      { workspaceId: ctx.workspace.id, entityType: "employee", entityId: ctx.employeeIds["EMP-006"], name: "Tax Form W-4.pdf", filePath: "/docs/w4-liam.pdf", type: "application/pdf", size: 120000, uploadedBy: ctx.admin.id },
    ],
  });
}

export async function seedFinance(ctx: SeedContext): Promise<void> {
  const { prisma, now } = ctx;

  // Customers / vendors
  for (const c of CUSTOMERS) {
    const cust = await prisma.customer.create({ data: { workspaceId: ctx.workspace.id, ...c } });
    ctx.customerIds[c.name] = cust.id;
  }
  for (const v of VENDORS) {
    const vend = await prisma.vendor.create({ data: { workspaceId: ctx.workspace.id, ...v } });
    ctx.vendorIds[v.name] = vend.id;
  }

  // Payroll runs for last two months
  const periods = [1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  for (const period of periods) {
    const offset = periods.indexOf(period) + 1;
    const { items, totals } = await buildPayrollRun(ctx.workspace.id, period);
    await prisma.payroll.create({
      data: {
        workspaceId: ctx.workspace.id,
        period,
        name: `Payroll ${period}`,
        status: offset === 2 ? "locked" : "paid",
        grossTotal: Math.round(totals.gross * 100) / 100,
        deductionTotal: Math.round(totals.deductions * 100) / 100,
        taxTotal: Math.round(totals.tax * 100) / 100,
        netTotal: Math.round(totals.net * 100) / 100,
        employerCostTotal: Math.round(totals.employer * 100) / 100,
        processedAt: new Date(now.getFullYear(), now.getMonth() - offset, 28),
        lockedAt: offset === 2 ? new Date(now.getFullYear(), now.getMonth() - offset + 1, 5) : null,
        approvedBy: ctx.admin.id,
        approvedAt: new Date(now.getFullYear(), now.getMonth() - offset, 25),
        items: { create: items.map((i) => ({ ...i, paymentStatus: "paid" })) },
      },
    });

    // Payroll journal
    const advanceTotal = items.reduce((a, i) => a + i.advanceDeduction, 0);
    const withheld = totals.deductions - advanceTotal;
    const employerTax = totals.employer - totals.gross;
    const line = {
      create: [
        { accountId: ctx.accountIds["5100"], debit: Math.round(totals.gross * 100) / 100, credit: 0 },
        { accountId: ctx.accountIds["5110"], debit: Math.round(employerTax * 100) / 100, credit: 0 },
        { accountId: ctx.accountIds["1010"], debit: 0, credit: Math.round(totals.net * 100) / 100 },
        { accountId: ctx.accountIds["2110"], debit: 0, credit: Math.round((withheld + employerTax) * 100) / 100 },
        ...(advanceTotal > 0
          ? [{ accountId: ctx.accountIds["2120"], debit: 0, credit: Math.round(advanceTotal * 100) / 100 }]
          : []),
      ],
    };
    await prisma.journalEntry.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `JE-PR-${period.replace("-", "")}`,
        date: new Date(now.getFullYear(), now.getMonth() - offset, 28),
        description: `Payroll journal for ${period}`,
        status: "posted",
        createdBy: ctx.admin.id,
        lines: line,
      },
    });
  }

  // Invoices
  let invNum = 1001;
  const invoiceIds: Record<string, string> = {};
  for (const inv of INVOICE_SEED) {
    const subtotal = inv.items.reduce((a, it) => a + it.qty * it.price, 0);
    const tax = Math.round(subtotal * inv.taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const invoice = await prisma.invoice.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `INV-${invNum}`,
        customerId: ctx.customerIds[inv.cust],
        date: dayAt(subDays(now, inv.daysAgo), 0, 0),
        dueDate: dayAt(addDays(subDays(now, inv.daysAgo), inv.dueDays), 0, 0),
        status: inv.status,
        subtotal,
        tax,
        total,
        paid: inv.paidAmount,
        terms: "Net 30",
        notes: "Thank you for your business.",
        items: {
          create: inv.items.map((it) => ({
            description: it.d,
            quantity: it.qty,
            unitPrice: it.price,
            tax: Math.round(it.qty * it.price * inv.taxRate * 100) / 100,
            amount: it.qty * it.price,
          })),
        },
      },
    });
    invoiceIds[`${inv.cust}-${invNum}`] = invoice.id;
    invNum++;

    await prisma.journalEntry.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `JE-INV-${invNum - 1}`,
        date: dayAt(subDays(now, inv.daysAgo), 0, 0),
        description: `Invoice ${invNum - 1} raised to ${inv.cust}`,
        status: "posted",
        createdBy: ctx.admin.id,
        lines: {
          create: [
            { accountId: ctx.accountIds["1100"], debit: total, credit: 0 },
            { accountId: ctx.accountIds["4000"], debit: 0, credit: total },
          ],
        },
      },
    });
  }

  // Incoming payments
  for (const p of PAYMENT_IN_SEED) {
    await prisma.payment.create({
      data: {
        workspaceId: ctx.workspace.id,
        reference: p.ref,
        date: dayAt(subDays(now, p.daysAgo), 0, 0),
        amount: p.amount,
        direction: "in",
        customerId: ctx.customerIds[p.cust],
        invoiceId: p.invKey ? invoiceIds[p.invKey] : null,
        method: p.method,
        bankAccountId: ctx.checking.id,
        notes: `Payment received from ${p.cust}`,
        reconciled: true,
        reconciledAt: dayAt(subDays(now, p.daysAgo), 0, 0),
      },
    });
    await prisma.journalEntry.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `JE-PMT-${p.ref.replace("PMT-", "")}`,
        date: dayAt(subDays(now, p.daysAgo), 0, 0),
        description: `Payment ${p.ref} from ${p.cust}`,
        status: "posted",
        createdBy: ctx.admin.id,
        lines: {
          create: [
            { accountId: ctx.accountIds["1010"], debit: p.amount, credit: 0 },
            { accountId: ctx.accountIds["1100"], debit: 0, credit: p.amount },
          ],
        },
      },
    });
  }

  // Expenses
  let expNum = 3001;
  for (const e of EXPENSE_SEED) {
    const expense = await prisma.expense.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `EXP-${expNum}`,
        vendorId: ctx.vendorIds[e.vendor],
        category: e.cat,
        date: dayAt(subDays(now, e.daysAgo), 0, 0),
        amount: e.amount,
        tax: Math.round(e.amount * 0.08 * 100) / 100,
        paymentMethod: e.method,
        accountId: ctx.accountIds[e.acc],
        description: e.desc,
        status: e.status,
        approvedBy: e.status === "paid" || e.status === "approved" ? ctx.admin.id : null,
        approvedAt: e.status === "paid" || e.status === "approved" ? subDays(now, e.daysAgo - 1) : null,
      },
    });
    expNum++;
    if (e.status === "paid") {
      await prisma.journalEntry.create({
        data: {
          workspaceId: ctx.workspace.id,
          number: `JE-EXP-${expNum - 1}`,
          date: dayAt(subDays(now, e.daysAgo), 0, 0),
          description: `Paid expense ${e.desc}`,
          status: "posted",
          createdBy: ctx.admin.id,
          lines: {
            create: [
              { accountId: ctx.accountIds[e.acc], debit: e.amount, credit: 0 },
              { accountId: ctx.accountIds["1010"], debit: 0, credit: e.amount },
            ],
          },
        },
      });
    }
  }

  // Income (non-invoice)
  let incNum = 5001;
  for (const inc of INCOME_SEED) {
    await prisma.income.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `INC-${incNum}`,
        customerId: ctx.customerIds[inc.cust],
        category: inc.cat,
        date: dayAt(subDays(now, inc.daysAgo), 0, 0),
        amount: inc.amount,
        tax: 0,
        paymentMethod: inc.method,
        accountId: ctx.accountIds[inc.acc],
        description: inc.desc,
      },
    });
    await prisma.journalEntry.create({
      data: {
        workspaceId: ctx.workspace.id,
        number: `JE-INC-${incNum}`,
        date: dayAt(subDays(now, inc.daysAgo), 0, 0),
        description: `Income ${inc.desc}`,
        status: "posted",
        createdBy: ctx.admin.id,
        lines: {
          create: [
            { accountId: ctx.accountIds["1010"], debit: inc.amount, credit: 0 },
            { accountId: ctx.accountIds[inc.acc], debit: 0, credit: inc.amount },
          ],
        },
      },
    });
    incNum++;
  }

  // Outgoing payments
  for (const p of PAYMENT_OUT_SEED) {
    await prisma.payment.create({
      data: {
        workspaceId: ctx.workspace.id,
        reference: p.ref,
        date: dayAt(subDays(now, p.daysAgo), 0, 0),
        amount: p.amount,
        direction: "out",
        vendorId: ctx.vendorIds[p.vendor],
        method: p.method,
        bankAccountId: ctx.checking.id,
        notes: `Payment to ${p.vendor}`,
        reconciled: true,
        reconciledAt: dayAt(subDays(now, p.daysAgo), 0, 0),
      },
    });
  }

  // Recompute account balances
  const accounts = await prisma.account.findMany({ where: { workspaceId: ctx.workspace.id } });
  for (const acc of accounts) {
    const lines = await prisma.journalLine.findMany({ where: { accountId: acc.id } });
    const net = lines.reduce((a, l) => a + l.debit - l.credit, 0);
    const balance = acc.type === "asset" || acc.type === "expense" ? acc.openingBalance + net : acc.openingBalance - net;
    await prisma.account.update({
      where: { id: acc.id },
      data: { balance: Math.round(balance * 100) / 100 },
    });
  }
}

export async function seedSubscription(ctx: SeedContext): Promise<void> {
  const { prisma, now } = ctx;

  const growthPlan = await prisma.subscriptionPlan.findUnique({ where: { name: "Growth" } });

  const trialEnd = addDays(now, 7);
  const subscription = await prisma.subscription.create({
    data: {
      workspaceId: ctx.workspace.id,
      planId: growthPlan?.id ?? null,
      planName: "Growth",
      status: "active",
      billingPeriod: "yearly",
      price: 990,
      employeeLimit: 100,
      isTrial: false,
      paymentStatus: "paid",
      approvedBy: ctx.admin.id,
      approvedAt: subDays(now, 40),
      startDate: subDays(now, 40),
      renewalDate: addDays(now, 325),
    },
  });
  await prisma.paymentRequest.create({
    data: {
      workspaceId: ctx.workspace.id,
      subscriptionId: subscription.id,
      amount: 990,
      method: "QR Code",
      reference: `SUB-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
      status: "paid",
      approvedBy: ctx.admin.id,
      approvedAt: subDays(now, 40),
    },
  });
}

// Re-export so seed.ts can import everything from one place
import { ANNOUNCEMENT_SEED, EMPLOYEES, LEAVE_REQUEST_SEED, TASK_SEED, WORK_RECORD_SEED, ADVANCE_SEED } from "./seed-data";