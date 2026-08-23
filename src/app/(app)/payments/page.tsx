import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentManager } from "./payment-manager";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "payments", "view")) {
    redirect("/?error=access_denied");
  }
  const [payments, invoices, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { date: "desc" },
      include: { customer: { select: { name: true } }, vendor: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { workspaceId: session.workspaceId, status: { in: ["sent", "viewed", "partially_paid"] } },
      select: { id: true, number: true },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({
      where: { workspaceId: session.workspaceId, status: { in: ["submitted", "approved"] } },
      select: { id: true, number: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const rows = payments.map((p) => ({
    id: p.id,
    reference: p.reference,
    date: p.date.toISOString().slice(0, 10),
    direction: p.direction === "in" ? "Money in" : "Money out",
    party: p.customer?.name ?? p.vendor?.name ?? "—",
    method: p.method,
    amount: p.amount,
    reconciled: p.reconciled,
    notes: p.notes ?? "",
  }));

  const stats = {
    incoming: payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0),
    outgoing: payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0),
    reconciled: payments.filter((p) => p.reconciled).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle={`${payments.length} payments recorded`} breadcrumb="Finance" />
      <PaymentManager
        rows={rows}
        invoices={invoices.map((i) => ({ id: i.id, label: i.number }))}
        expenses={expenses.map((e) => ({ id: e.id, label: e.number }))}
        stats={stats}
      />
    </div>
  );
}