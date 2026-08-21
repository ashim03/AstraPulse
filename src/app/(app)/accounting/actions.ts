"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { postJournalEntry, recomputeAccountBalance } from "@/services/accounting";
import { z } from "zod";

const accountSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  openingBalance: z.coerce.number().default(0),
});

export async function createAccountAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;
  const existing = await prisma.account.findUnique({ where: { workspaceId_code: { workspaceId: session.workspaceId, code: d.code } } });
  if (existing) return fail("An account with this code already exists", { code: "Duplicate code" });
  const account = await prisma.account.create({
    data: {
      workspaceId: session.workspaceId,
      code: d.code,
      name: d.name,
      type: d.type,
      openingBalance: d.openingBalance,
      balance: d.openingBalance,
      status: "active",
    },
  });
  await writeAudit({ session, action: "create", module: "accounting", recordId: account.id, description: `Created account ${d.code} ${d.name}` });
  revalidatePath("/accounting");
  return ok(undefined, "Account created");
}

const journalSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  debitAccount: z.string().min(1, "Select account"),
  debitAmount: z.coerce.number().positive("Enter a valid amount"),
  creditAccount: z.string().min(1, "Select account"),
  creditAmount: z.coerce.number().positive("Enter a valid amount"),
});

export async function createJournalEntryAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = journalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;
  if (d.debitAccount === d.creditAccount) return fail("Debit and credit must use different accounts");
  if (Math.abs(d.debitAmount - d.creditAmount) > 0.001) return fail("Debits and credits must balance");

  const seq = await prisma.journalEntry.count({ where: { workspaceId: session.workspaceId } });
  const entry = await prisma.journalEntry.create({
    data: {
      workspaceId: session.workspaceId,
      number: `JE-${String(seq + 1).padStart(4, "0")}`,
      date: new Date(d.date),
      description: d.description,
      status: "draft",
      createdBy: session.id,
      lines: {
        create: [
          { accountId: d.debitAccount, debit: d.debitAmount, credit: 0 },
          { accountId: d.creditAccount, debit: 0, credit: d.creditAmount },
        ],
      },
    },
  });
  await writeAudit({ session, action: "create", module: "accounting", recordId: entry.id, description: `Drafted journal ${entry.number}: ${d.description}` });
  revalidatePath("/accounting");
  return ok(undefined, "Journal entry drafted");
}

export async function postJournalAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const entry = await prisma.journalEntry.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!entry) return fail("Journal entry not found");
  try {
    await postJournalEntry(id, session.workspaceId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to post entry");
  }
  await writeAudit({ session, action: "post", module: "accounting", recordId: id, description: `Posted journal ${entry.number}` });
  revalidatePath("/accounting");
  return ok(undefined, "Journal posted");
}

export async function createBankAccountAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "");
  const bank = String(formData.get("bank") ?? "");
  const accountNumber = String(formData.get("accountNumber") ?? "");
  const openingBalance = Number(formData.get("openingBalance") ?? 0);
  if (!name || !bank || !accountNumber) return fail("Name, bank, and account number are required");
  const account = await prisma.bankAccount.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      bank,
      accountNumber,
      openingBalance: isNaN(openingBalance) ? 0 : openingBalance,
      currentBalance: isNaN(openingBalance) ? 0 : openingBalance,
    },
  });
  await writeAudit({ session, action: "create", module: "accounting", recordId: account.id, description: `Created bank account ${name}` });
  revalidatePath("/accounting");
  return ok(undefined, "Bank account added");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}