import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseManager } from "./expense-manager";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await requireSession();
  if (!hasPermission(session, "expenses", "view")) {
    redirect("/?error=access_denied");
  }
  const expenses = await prisma.expense.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { date: "desc" },
    include: { vendor: { select: { name: true } }, employee: { select: { name: true } } },
  });

  const rows = expenses.map((e) => ({
    id: e.id,
    number: e.number,
    vendor: e.vendor?.name ?? e.employee?.name ?? "—",
    category: e.category,
    date: e.date.toISOString().slice(0, 10),
    amount: e.amount,
    tax: e.tax,
    status: e.status,
    description: e.description ?? "",
  }));

  const total = expenses.filter((e) => e.status !== "rejected").reduce((s, e) => s + e.amount + e.tax, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" subtitle={`${expenses.length} expenses • ${total.toLocaleString("en-US", { style: "currency", currency: "NPR" })} total`} breadcrumb="Finance" />
      <ExpenseManager rows={rows} />
    </div>
  );
}