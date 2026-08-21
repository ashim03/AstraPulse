import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceManager, type CustomerOption } from "./invoice-manager";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const session = await requireSession();
  const [invoices, customers] = await Promise.all([
    prisma.invoice.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { date: "desc" },
      include: { customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    customer: i.customer.name,
    date: i.date.toISOString().slice(0, 10),
    dueDate: i.dueDate.toISOString().slice(0, 10),
    total: i.total,
    paid: i.paid,
    status: i.status,
  }));

  const outstanding = invoices.filter((i) => !["paid", "cancelled", "draft"].includes(i.status)).reduce((s, i) => s + i.total - i.paid, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle={`${invoices.length} invoices • ${outstanding.toLocaleString("en-US", { style: "currency", currency: "NPR" })} outstanding`} breadcrumb="Finance" />
      <InvoiceManager rows={rows} customers={customers as CustomerOption[]} />
    </div>
  );
}