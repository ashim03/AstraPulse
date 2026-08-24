"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";

async function requirePermission(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function updateWorkspaceSettingsAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("settings", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "");
  const country = String(formData.get("country") ?? "");
  const currency = String(formData.get("currency") ?? "NPR");
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
  let session;
  try {
    session = await requirePermission("settings", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Name is required");
  await prisma.user.update({ where: { id: session.id }, data: { name } });
  revalidatePath("/settings");
  return ok(undefined, "Profile updated");
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("settings", "edit");
  } catch {
    return fail("You don't have permission");
  }

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return fail("No file uploaded");
  if (file.size > 2 * 1024 * 1024) return fail("File too large (max 2MB)");
  if (!file.type.startsWith("image/")) return fail("File must be an image");

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  await prisma.workspace.update({
    where: { id: session.workspaceId },
    data: { logo: dataUri },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return ok(undefined, "Logo uploaded");
}

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Not authenticated");
  }

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return fail("No file uploaded");
  if (file.size > 2 * 1024 * 1024) return fail("File too large (max 2MB)");
  if (!file.type.startsWith("image/")) return fail("File must be an image");

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  // Update employee avatar (linked to user)
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { employeeId: true } });
  if (user?.employeeId) {
    await prisma.employee.update({
      where: { id: user.employeeId },
      data: { avatar: dataUri },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/employee");
  return ok(undefined, "Avatar uploaded");
}