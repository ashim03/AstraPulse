"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, canModifyEmployee, canAccessEmployee, getDataScope, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";
import { z } from "zod";

async function requirePerm(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  employeeId: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  positionId: z.string().optional().or(z.literal("")),
  employmentType: z.string().optional(),
  salary: z.coerce.number().min(0).optional(),
  hireDate: z.string().optional().or(z.literal("")),
  contractEndDate: z.string().optional().or(z.literal("")),
  status: z.string().optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  nationalId: z.string().optional().or(z.literal("")),
  bankName: z.string().optional().or(z.literal("")),
  accountNumber: z.string().optional().or(z.literal("")),
  currency: z.string().optional().or(z.literal("")),
});

export async function createEmployeeAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toFieldErrors(parsed.error));

  const d = parsed.data;
  const existing = await prisma.user.findFirst({ where: { workspaceId: session.workspaceId, email: d.email } });
  if (existing) return fail("An account with this email already exists", { email: "Email already in use" });

  try {
    const role = await prisma.role.findFirst({ where: { workspaceId: session.workspaceId, name: "Employee" } });

    const employee = await prisma.employee.create({
      data: {
        workspaceId: session.workspaceId,
        name: d.name,
        employeeId: d.employeeId || `EMP-${String(Math.floor(1000 + Math.random() * 9000))}`,
        email: d.email,
        phone: d.phone || null,
        departmentId: d.departmentId || null,
        positionId: d.positionId || null,
        employmentType: (d.employmentType as never) || "full_time",
        baseSalary: d.salary ?? 0,
        joinDate: d.hireDate ? new Date(d.hireDate) : new Date(),
        contractEndDate: d.contractEndDate ? new Date(d.contractEndDate) : null,
        status: (d.status as never) || "active",
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
        gender: d.gender || null,
        address: d.address || null,
        emergencyName: d.emergencyContactName || null,
        emergencyPhone: d.emergencyContactPhone || null,
        taxId: d.nationalId || null,
        bankName: d.bankName || null,
        bankAccountNumber: d.accountNumber || null,
      },
    });

    const user = await prisma.user.create({
      data: {
        workspaceId: session.workspaceId,
        email: d.email,
        name: d.name,
        passwordHash: hashPassword("Change@123"),
        roleId: role?.id ?? null,
        employeeId: employee.id,
        status: "active",
      },
    });

    await writeAudit({
      session,
      action: "create",
      module: "staff",
      recordId: employee.id,
      description: `Created employee ${employee.name}`,
    });
    await notify(session.workspaceId, user.id, "Welcome to the workspace", `Your employee account has been created.`, "/dashboard");

    revalidatePath("/staff");
    return ok(undefined, "Employee added");
  } catch (e) {
    return fail("Failed to create employee: " + (e as Error).message);
  }
}

export async function updateEmployeeStatusAction(id: string, status: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const current = await prisma.employee.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!current) return fail("Employee not found");
  if (!canModifyEmployee(session, id, current.departmentId)) {
    await writeAudit({ session, action: "denied", module: "staff", recordId: id, description: `Permission denied: cannot modify employee status` });
    return fail("You don't have permission to modify this employee");
  }
  await prisma.employee.update({ where: { id }, data: { status: status as never } });
  await writeAudit({ session, action: "edit", module: "staff", recordId: id, description: `Updated status of ${current.name} to ${status}` });
  revalidatePath("/staff");
  return ok(undefined, "Status updated");
}

export async function updateEmployeeAction(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toFieldErrors(parsed.error));
  const d = parsed.data;
  try {
    const current = await prisma.employee.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!current) return fail("Employee not found");
    if (!canModifyEmployee(session, id, current.departmentId)) {
      await writeAudit({ session, action: "denied", module: "staff", recordId: id, description: `Permission denied: cannot modify employee` });
      return fail("You don't have permission to modify this employee");
    }
    await prisma.employee.update({
      where: { id },
      data: {
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        departmentId: d.departmentId || null,
        positionId: d.positionId || null,
        employmentType: (d.employmentType as never) || "full_time",
        baseSalary: d.salary ?? 0,
        contractEndDate: d.contractEndDate ? new Date(d.contractEndDate) : null,
        status: (d.status as never) || "active",
        address: d.address || null,
      },
    });
    await prisma.user.updateMany({ where: { employeeId: id }, data: { name: d.name, email: d.email } });
    await writeAudit({ session, action: "edit", module: "staff", recordId: id, description: `Updated employee ${d.name}` });
    revalidatePath("/staff");
    revalidatePath(`/staff/${id}`);
    return ok(undefined, "Employee updated");
  } catch (e) {
    return fail("Failed to update employee: " + (e as Error).message);
  }
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "delete");
  } catch {
    return fail("You don't have permission");
  }
  const employee = await prisma.employee.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!employee) return fail("Employee not found");
  await prisma.employee.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "staff", recordId: id, description: `Deleted employee ${employee.name}` });
  revalidatePath("/staff");
  return ok(undefined, "Employee deleted");
}

export async function createDepartmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requirePerm("departments", "create");
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!name) return fail("Department name is required", { name: "Required" });
    const existing = await prisma.department.findFirst({ where: { workspaceId: session.workspaceId, name } });
    if (existing) return fail("Department already exists", { name: "Already exists" });
    await prisma.department.create({ data: { workspaceId: session.workspaceId, name, description: description || null } });
    await writeAudit({ session, action: "create", module: "departments", description: `Created department ${name}` });
    revalidatePath("/departments");
    return ok(undefined, "Department created");
  } catch (e) {
    return fail("Failed to create department. Please try again.");
  }
}

export async function updateDepartmentAction(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("departments", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Department name is required", { name: "Required" });
  const dept = await prisma.department.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!dept) return fail("Department not found");
  await prisma.department.update({ where: { id }, data: { name, description: String(formData.get("description") ?? "").trim() || null } });
  await writeAudit({ session, action: "edit", module: "departments", recordId: id, description: `Renamed department to ${name}` });
  revalidatePath("/departments");
  return ok(undefined, "Department updated");
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("departments", "delete");
    const dept = await prisma.department.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!dept) return fail("Department not found");
    await prisma.department.delete({ where: { id } });
    await writeAudit({ session, action: "delete", module: "departments", recordId: id, description: `Deleted department ${dept.name}` });
    revalidatePath("/departments");
    return ok(undefined, "Department deleted");
  } catch (e) {
    return fail("Failed to delete department. It may have employees assigned to it.");
  }
}

export async function getStaffWithFiltersAction(filters: {
  search?: string;
  department?: string;
  employmentType?: string;
  status?: string;
  gender?: string;
  sortBy?: string;
  sortOrder?: string;
  letter?: string;
}): Promise<ActionResult<unknown[]>> {
  try {
    const session = await requireSession();
    if (!hasPermission(session, "staff", "view")) {
      await writeAudit({ session, action: "denied", module: "staff", description: "Permission denied: staff:view" });
      return fail("You don't have permission to view staff");
    }
    const scope = getDataScope(session);
    const where: Record<string, unknown> = { workspaceId: session.workspaceId };

    if (scope === "self") {
      where.id = session.employeeId;
    } else if (scope === "department" && session.departmentId) {
      where.departmentId = session.departmentId;
    }

    if (filters.search) {
      const q = filters.search;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { employeeId: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (filters.department) where.departmentId = filters.department;
    if (filters.employmentType) where.employmentType = filters.employmentType;
    if (filters.status) where.status = filters.status;
    if (filters.gender) where.gender = filters.gender;
    if (filters.letter) {
      where.name = { startsWith: filters.letter, mode: "insensitive" };
    }

    const sortField = filters.sortBy || "name";
    const sortDir = filters.sortOrder === "desc" ? "desc" : "asc";
    const orderBy: Record<string, string> = { [sortField]: sortDir };

    const employees = await prisma.employee.findMany({
      where,
      include: { department: true, position: true },
      orderBy,
    });

    return ok(employees);
  } catch (e) {
    return fail("Failed to load staff: " + (e as Error).message);
  }
}

function toFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}
