import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { AccountingManager, type AccountOption } from "./accounting-manager";


export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const session = await requireSession();
  if (!hasPermission(session, "accounting", "view")) {
    redirect("/?error=access_denied");
  }
  const [accountsWithJournals, journals, banks] = await Promise.all([
    prisma.account.findMany({
      where: { workspaceId: session.workspaceId },
      include: { journalLines: true },
      orderBy: { code: "asc" },
    }),
    prisma.journalEntry.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.bankAccount.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } }),
  ]);

  const accountsWithBalance: AccountOption[] = accountsWithJournals.map((a) => {
    const net = a.journalLines.reduce((acc, line) => acc + line.debit - line.credit, 0);
    const balance =
      a.type === "asset" || a.type === "expense" ? a.openingBalance + net : a.openingBalance - net;
    return { id: a.id, code: a.code, name: a.name, type: a.type, balance: Math.round(balance * 100) / 100 };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        subtitle="Chart of accounts, journal entries, and bank accounts."
        breadcrumb="Finance"
      />
      <AccountingManager
        accounts={accountsWithBalance}
        journalRows={journals.map((j) => ({ id: j.id, number: j.number, date: j.date.toISOString().slice(0, 10), description: j.description, status: j.status }))}
        banks={banks.map((b) => ({ id: b.id, name: b.name, bank: b.bank, accountNumber: b.accountNumber, currentBalance: b.currentBalance }))}
      />
    </div>
  );
}