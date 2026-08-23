import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { IncomeManager } from "./income-manager";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const session = await requireSession();
  if (!hasPermission(session, "income", "view")) {
    redirect("/?error=access_denied");
  }
  const incomes = await prisma.income.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { date: "desc" },
    include: { customer: { select: { name: true } } },
  });

  const rows = incomes.map((i) => ({
    id: i.id,
    number: i.number,
    customer: i.customer?.name ?? "—",
    category: i.category,
    date: i.date.toISOString().slice(0, 10),
    amount: i.amount,
    tax: i.tax,
    description: i.description ?? "",
  }));

  const total = incomes.reduce((s, i) => s + i.amount + i.tax, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Income" subtitle={`${incomes.length} entries • ${total.toLocaleString("en-US", { style: "currency", currency: "NPR" })} total`} breadcrumb="Finance" />
      <IncomeManager rows={rows} />
    </div>
  );
}