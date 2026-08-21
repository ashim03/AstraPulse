"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";

export async function updateWorkspaceSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "");
  const country = String(formData.get("country") ?? "");
  const currency = String(formData.get("currency") ?? "USD");
  const timezone = String(formData.get("timezone") ?? "America/New_York");
  const dateFormat = String(formData.get("dateFormat") ?? "MM/DD/YYYY");
  const fiscalYearStart = Number(formData.get("fiscalYearStart") ?? 1);

  if (!name || !email) return fail("Name and email are required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email", { email: "Invalid email" });

  await prisma.workspace.update({
    where: { id: session.workspaceId },
    data: { name, email, phone: phone || null, country: country || null, currency, timezone, dateFormat, fiscalYearStart },
  });
  await writeAudit({ session, action: "update", module: "settings", recordId: session.workspaceId, description: "Updated workspace settings" });
  revalidatePath("/settings");
  return ok(undefined, "Settings saved");
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Name is required");
  await prisma.user.update({ where: { id: session.id }, data: { name } });
  revalidatePath("/settings");
  return ok(undefined, "Profile updated");
}