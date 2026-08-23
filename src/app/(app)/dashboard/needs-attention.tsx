import Link from "next/link";
import { CalendarClock, FileText, HandCoins, Receipt, UserX, FileWarning, ChevronRight, CheckCircle, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

type Needs = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  items: Array<{ title: string; sub?: string; badge?: string; badgeTone?: string }>;
};

export async function NeedsAttention({ workspaceId, role, employeeId }: { workspaceId: string; role?: string; employeeId?: string }) {
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 86400000);
  const isEmployee = role === "Employee";
  const isManager = role === "Manager";

  const [pendingLeave, unpaidInvoices, pendingExpenses, contractExpiries, outstandingAdvances, expiringDocs, myTasks] =
    await Promise.all([
      isEmployee && employeeId
        ? prisma.leaveRequest.findMany({
            where: { workspaceId, status: "pending", employeeId },
            include: { employee: true, type: true },
            orderBy: { createdAt: "asc" },
            take: 4,
          })
        : isManager
          ? prisma.leaveRequest.findMany({
              where: { workspaceId, status: "pending", employee: { department: { workspaceId } } },
              include: { employee: true, type: true },
              orderBy: { createdAt: "asc" },
              take: 4,
            })
          : prisma.leaveRequest.findMany({
              where: { workspaceId, status: "pending" },
              include: { employee: true, type: true },
              orderBy: { createdAt: "asc" },
              take: 4,
            }),
      isEmployee
        ? Promise.resolve([])
        : prisma.invoice.findMany({
            where: { workspaceId, status: { in: ["sent", "viewed", "overdue", "partially_paid"] } },
            include: { customer: true },
            orderBy: { dueDate: "asc" },
            take: 4,
          }),
      isEmployee
        ? Promise.resolve([])
        : prisma.expense.findMany({
            where: { workspaceId, status: "submitted" },
            include: { vendor: true },
            orderBy: { date: "asc" },
            take: 4,
          }),
      isEmployee
        ? Promise.resolve([])
        : prisma.employee.findMany({
            where: { workspaceId, contractEndDate: { not: null, lte: soon }, status: "active" },
            orderBy: { contractEndDate: "asc" },
            take: 4,
          }),
      isEmployee
        ? Promise.resolve([])
        : prisma.employeeAdvance.findMany({
            where: { workspaceId, status: { in: ["approved", "paid"] }, outstanding: { gt: 0 } },
            include: { employee: true },
            orderBy: { date: "asc" },
            take: 4,
          }),
      isEmployee
        ? Promise.resolve([])
        : prisma.document.findMany({
            where: { workspaceId, expiresAt: { not: null, lte: soon } },
            orderBy: { expiresAt: "asc" },
            take: 4,
          }),
      isEmployee && employeeId
        ? prisma.workRecord.findMany({
            where: { workspaceId, employeeId, status: { in: ["pending", "submitted"] } },
            include: { employee: true },
            orderBy: { date: "asc" },
            take: 4,
          })
        : isManager
          ? prisma.workRecord.findMany({
              where: { workspaceId, status: "pending", employee: { department: { workspaceId } } },
              include: { employee: true },
              orderBy: { date: "asc" },
              take: 4,
            })
          : Promise.resolve([]),
    ]);

  const sections: Needs[] = isEmployee
    ? [
        {
          label: "My pending leave requests",
          href: "/leave",
          icon: CalendarClock,
          tone: "bg-amber-50 text-amber-600",
          items: pendingLeave.map((r) => ({
            title: r.type.name,
            sub: `${formatDate(r.startDate)} · ${r.days}d`,
            badge: r.status,
          })),
        },
        {
          label: "My tasks",
          href: "/tasks",
          icon: ClipboardList,
          tone: "bg-indigo-50 text-indigo-600",
          items: myTasks.map((t) => ({
            title: t.employee.name,
            sub: `Due ${formatDate(t.date)}`,
            badge: t.status,
          })),
        },
      ]
    : isManager
      ? [
          {
            label: "Pending leave approvals",
            href: "/leave",
            icon: CalendarClock,
            tone: "bg-amber-50 text-amber-600",
            items: pendingLeave.map((r) => ({
              title: r.employee.name,
              sub: `${r.type.name} · ${formatDate(r.startDate)}`,
              badge: `${r.days}d`,
            })),
          },
          {
            label: "Pending work records",
            href: "/attendance",
            icon: ClipboardList,
            tone: "bg-indigo-50 text-indigo-600",
            items: myTasks.map((t) => ({
              title: t.employee.name,
              sub: `Submitted ${formatDate(t.date)}`,
              badge: t.status,
            })),
          },
        ]
      : [
          {
            label: "Pending leave approvals",
            href: "/leave",
            icon: CalendarClock,
            tone: "bg-amber-50 text-amber-600",
            items: pendingLeave.map((r) => ({
              title: r.employee.name,
              sub: `${r.type.name} · ${formatDate(r.startDate)}`,
              badge: `${r.days}d`,
            })),
          },
          {
            label: "Unpaid invoices",
            href: "/invoices",
            icon: FileText,
            tone: "bg-red-50 text-red-600",
            items: unpaidInvoices.map((i) => ({
              title: `${i.number} · ${i.customer.name}`,
              sub: `Due ${formatDate(i.dueDate)}`,
              badge: `Rs. ${(i.total - i.paid).toLocaleString()}`,
            })),
          },
          {
            label: "Expense approvals",
            href: "/expenses",
            icon: Receipt,
            tone: "bg-sky-50 text-sky-600",
            items: pendingExpenses.map((e) => ({
              title: `${e.number} · ${e.vendor?.name ?? "—"}`,
              sub: e.category,
              badge: `Rs. ${e.amount.toLocaleString()}`,
            })),
          },
          {
            label: "Contract expirations",
            href: "/staff",
            icon: UserX,
            tone: "bg-orange-50 text-orange-600",
            items: contractExpiries.map((e) => ({
              title: e.name,
              sub: `Contract ends ${formatDate(e.contractEndDate)}`,
            })),
          },
          {
            label: "Outstanding advances",
            href: "/advances",
            icon: HandCoins,
            tone: "bg-violet-50 text-violet-600",
            items: outstandingAdvances.map((a) => ({
              title: a.employee.name,
              sub: `Outstanding Rs. ${a.outstanding.toLocaleString()}`,
            })),
          },
          {
            label: "Documents expiring",
            href: "/staff",
            icon: FileWarning,
            tone: "bg-rose-50 text-rose-600",
            items: expiringDocs.map((d) => ({
              title: d.name,
              sub: `Expires ${formatDate(d.expiresAt)}`,
            })),
          },
        ];

  const hasItems = sections.some((s) => s.items.length > 0);

  return (
    <Card>
      <CardHeader
        title="Needs Attention"
        subtitle="Items that require your review"
        action={
          hasItems ? (
            <Link href="/audit-logs" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : undefined
        }
      />
      <CardBody className="space-y-4 px-5 py-4">
        {!hasItems && (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle className="h-5 w-5" />
            <span>All caught up — nothing needs your attention.</span>
          </div>
        )}
        {sections.map((section) =>
          section.items.length === 0 ? null : (
            <div key={section.label}>
              <Link href={section.href} className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-700">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${section.tone}`}>
                  <section.icon className="h-3.5 w-3.5" />
                </span>
                {section.label}
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500">
                  {section.items.length}
                </span>
              </Link>
              <div className="space-y-2">
                {section.items.map((item, i) => (
                  <Link key={i} href={section.href} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 transition hover:border-slate-200 hover:bg-white dark:hover:bg-slate-800">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={item.title} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{item.title}</p>
                        {item.sub && <p className="truncate text-xs text-slate-400">{item.sub}</p>}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="shrink-0 text-xs font-semibold text-slate-600">{item.badge}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
}