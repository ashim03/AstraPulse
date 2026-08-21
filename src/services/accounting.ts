import { prisma } from "@/lib/prisma";

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
};

// Recompute an account balance from opening balance + journal lines.
export async function recomputeAccountBalance(accountId: string): Promise<number> {
  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { journalLines: true } });
  if (!account) return 0;
  const net = account.journalLines.reduce((acc, line) => acc + line.debit - line.credit, 0);
  const balance =
    account.type === "asset" || account.type === "expense" ? account.openingBalance + net : account.openingBalance - net;
  return Math.round(balance * 100) / 100;
}

export async function postJournalEntry(entryId: string, workspaceId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });
  if (!entry) throw new Error("Journal entry not found");
  const debit = entry.lines.reduce((a, l) => a + l.debit, 0);
  const credit = entry.lines.reduce((a, l) => a + l.credit, 0);
  if (Math.abs(debit - credit) > 0.001) throw new Error("Debits and credits must balance");

  for (const line of entry.lines) {
    const balance = await recomputeAccountBalance(line.accountId);
    await prisma.account.update({ where: { id: line.accountId }, data: { balance } });
  }
  await prisma.journalEntry.update({ where: { id: entryId }, data: { status: "posted" } });
}

export async function createAutoJournal(opts: {
  workspaceId: string;
  date: Date;
  description: string;
  lines: Array<{ accountCode: string; debit?: number; credit?: number }>;
  number?: string;
}) {
  const seq = await prisma.journalEntry.count({ where: { workspaceId: opts.workspaceId } });
  const accounts = await prisma.account.findMany({
    where: { workspaceId: opts.workspaceId, code: { in: opts.lines.map((l) => l.accountCode) } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  const missing = opts.lines.find((l) => !byCode.has(l.accountCode));
  if (missing) throw new Error(`Unknown account code ${missing.accountCode}`);

  const entry = await prisma.journalEntry.create({
    data: {
      workspaceId: opts.workspaceId,
      number: opts.number ?? `JE-${String(seq + 1).padStart(4, "0")}`,
      date: opts.date,
      description: opts.description,
      status: "posted",
      lines: {
        create: opts.lines.map((l) => ({
          accountId: byCode.get(l.accountCode)!,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
        })),
      },
    },
  });

  for (const line of opts.lines) {
    const accountId = byCode.get(line.accountCode)!;
    const balance = await recomputeAccountBalance(accountId);
    await prisma.account.update({ where: { id: accountId }, data: { balance } });
  }
  return entry;
}

export async function ledgerForAccount(workspaceId: string, accountId?: string, from?: Date, to?: Date) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      workspaceId,
      status: "posted",
      date: { gte: from, lte: to },
      ...(accountId ? { lines: { some: { accountId } } } : {}),
    },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "asc" },
  });
  const accounts = await prisma.account.findMany({ where: { workspaceId }, orderBy: { code: "asc" } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return { entries, accounts, byId };
}