"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";

export async function createHolidayAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!name) return fail("Holiday name is required", { name: "Required" });
  if (!date) return fail("Date is required", { date: "Required" });
  const existing = await prisma.holiday.findFirst({ where: { workspaceId: session.workspaceId, name, date: new Date(date) } });
  if (existing) return fail("This holiday already exists", { name: "Already exists" });
  await prisma.holiday.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      date: new Date(date),
      recurring: formData.get("recurring") === "on",
      region: String(formData.get("region") ?? "") || null,
    },
  });
  await writeAudit({ session, action: "create", module: "holidays", description: `Added holiday ${name}` });
  revalidatePath("/holidays");
  return ok(undefined, "Holiday added");
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const holiday = await prisma.holiday.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!holiday) return fail("Holiday not found");
  await prisma.holiday.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "holidays", recordId: id, description: `Removed holiday ${holiday.name}` });
  revalidatePath("/holidays");
  return ok(undefined, "Holiday removed");
}