import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceDetailClient } from "./invoice-detail-client";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, workspaceId: session.workspaceId },
    include: {
      customer: { select: { name: true, email: true, phone: true, address: true } },
      items: true,
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!invoice) notFound();

  const remaining = Math.max(0, invoice.total - invoice.paid);

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.number}
        subtitle={`${invoice.customer.name} • ${invoice.status}`}
        breadcrumb={<>{"Invoices"} / {invoice.number}</>}
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{money(invoice.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Paid</p>
          <p className="text-xl font-bold text-emerald-600">{money(invoice.paid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Remaining</p>
          <p className="text-xl font-bold text-amber-600">{money(remaining)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Due date</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{invoice.dueDate.toLocaleDateString()}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit price</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{item.description}</td>
                <td className="px-4 py-2 text-right text-slate-500">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-slate-500">{money(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-500">Subtotal</td><td className="px-4 py-2 text-right font-medium">{money(invoice.subtotal)}</td></tr>
            {invoice.discount > 0 && (
              <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-500">Discount</td><td className="px-4 py-2 text-right font-medium">-{money(invoice.discount)}</td></tr>
            )}
            <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-500">Tax</td><td className="px-4 py-2 text-right font-medium">{money(invoice.tax)}</td></tr>
            <tr className="bg-slate-50"><td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-800">Total</td><td className="px-4 py-2 text-right font-bold text-slate-900 dark:text-slate-100">{money(invoice.total)}</td></tr>
          </tfoot>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Customer</h3>
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          <p>{invoice.customer.name}</p>
          {invoice.customer.email && <p>{invoice.customer.email}</p>}
          {invoice.customer.phone && <p>{invoice.customer.phone}</p>}
          {invoice.customer.address && <p>{invoice.customer.address}</p>}
        </div>
      </Card>

      <InvoiceDetailClient
        invoiceId={invoice.id}
        status={invoice.status}
        remaining={remaining}
        payments={invoice.payments.map((p) => ({
          id: p.id,
          reference: p.reference,
          date: p.date.toISOString().slice(0, 10),
          amount: p.amount,
          method: p.method,
        }))}
      />
    </div>
  );
}