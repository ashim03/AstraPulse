"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, hashPassword } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionResult, ok, fail, writeAudit } from "@/lib/actions";
import { syncEmployeeToDevice, unsyncEmployeeFromDevice } from "@/services/device-sync";

export type CreateStaffInput = {
  name: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  joiningDate: Date | string;
  employmentType: string;
  basicSalary: number;
  address?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  emergencyContact?: string;
  emergencyContactName?: string;
  password?: string;
};

async function generateEmployeeId(workspaceId: string): Promise<string> {
  const lastEmployee = await prisma.employee.findFirst({
    where: { workspaceId },
    orderBy: { employeeId: "desc" },
    select: { employeeId: true },
  });

  if (!lastEmployee?.employeeId) {
    return "EMP-001";
  }

  const match = lastEmployee.employeeId.match(/EMP-(\d+)/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `EMP-${String(nextNum).padStart(3, "0")}`;
}

export async function createStaffAction(
  data: CreateStaffInput
): Promise<ActionResult<{ employee: any; syncStatus?: string }>> {
  const session = await requireSession();

  if (!hasPermission(session, "staff", "manage")) {
    return fail("You do not have permission to create staff");
  }

  if (!data.name || !data.joiningDate || !data.employmentType || data.basicSalary == null) {
    return fail("Missing required fields", {
      ...(!data.name && { name: "Name is required" }),
      ...(!data.joiningDate && { joiningDate: "Joining date is required" }),
      ...(!data.employmentType && { employmentType: "Employment type is required" }),
      ...(data.basicSalary == null && { basicSalary: "Basic salary is required" }),
    });
  }

  const employeeId = await generateEmployeeId(session.workspaceId);
  const email = data.email || `${employeeId.toLowerCase()}@astrapulse.local`;

  const defaultPassword = data.password || "Aicnepal@001";
  const hashedPassword = await hashPassword(defaultPassword);

  const role = await prisma.role.findFirst({
    where: { workspaceId: session.workspaceId, name: { contains: "Employee", mode: "insensitive" } },
  });

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        workspaceId: session.workspaceId,
        employeeId,
        name: data.name,
        email,
        phone: data.phone || undefined,
        departmentId: data.departmentId,
        joinDate: new Date(data.joiningDate),
        employmentType: data.employmentType,
        baseSalary: data.basicSalary,
        address: data.address || undefined,
        gender: data.gender || undefined,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        emergencyPhone: data.emergencyContact || undefined,
        emergencyName: data.emergencyContactName || undefined,
        status: "active",
      },
    });

    await tx.user.create({
      data: {
        workspaceId: session.workspaceId,
        name: data.name,
        email,
        passwordHash: hashedPassword,
        roleId: role?.id,
        employeeId: emp.id,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: "active",
      },
    });

    return emp;
  });

  let syncStatus = "no_device";

  const activeDevice = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (activeDevice) {
    const result = await syncEmployeeToDevice(
      { id: employee.id, employeeId: employee.employeeId, name: employee.name },
      activeDevice.id
    );
    syncStatus = result.success ? "synced" : "failed";
  }

  await writeAudit({
    session,
    action: "create",
    module: "staff",
    recordId: employee.id,
    description: `Created staff member ${employee.name} (${employee.employeeId})`,
    after: { employeeId, name: employee.name, email: employee.email },
  });

  revalidatePath("/staff");

  return ok({ employee, syncStatus }, `Staff member ${employee.name} created successfully`);
}

export async function updateStaffAction(
  id: string,
  data: Partial<CreateStaffInput>
): Promise<ActionResult> {
  const session = await requireSession();

  if (!hasPermission(session, "staff", "manage")) {
    return fail("You do not have permission to update staff");
  }

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    return fail("Staff member not found");
  }

  const before = {
    name: existing.name,
    email: existing.email,
    departmentId: existing.departmentId,
  };

  const updateData: Record<string, any> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
  if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
  if (data.basicSalary !== undefined) updateData.baseSalary = data.basicSalary;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.emergencyContact !== undefined) updateData.emergencyPhone = data.emergencyContact;
  if (data.emergencyContactName !== undefined) updateData.emergencyName = data.emergencyContactName;

  const employee = await prisma.employee.update({
    where: { id },
    data: updateData,
  });

  if (data.name && data.name !== existing.name) {
    const user = await prisma.user.findFirst({
      where: { employeeId: id },
    });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: data.name },
      });
    }
  }

  await writeAudit({
    session,
    action: "update",
    module: "staff",
    recordId: id,
    description: `Updated staff member ${employee.name} (${employee.employeeId})`,
    before,
    after: { ...updateData },
  });

  revalidatePath("/staff");

  return ok(null, `Staff member ${employee.name} updated successfully`);
}

export async function deactivateStaffAction(id: string): Promise<ActionResult> {
  const session = await requireSession();

  if (!hasPermission(session, "staff", "manage")) {
    return fail("You do not have permission to deactivate staff");
  }

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { workspace: { include: { attendanceDevices: true } } },
  });

  if (!existing) {
    return fail("Staff member not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: { status: "inactive" },
    });

    const user = await tx.user.findFirst({ where: { employeeId: id } });
    if (user) {
      await tx.user.update({
        where: { id: user.id },
        data: { status: "inactive" },
      });
    }
  });

  if (existing.deviceEmployeeId) {
    await unsyncEmployeeFromDevice(id).catch(() => {});
  }

  await writeAudit({
    session,
    action: "deactivate",
    module: "staff",
    recordId: id,
    description: `Deactivated staff member ${existing.name} (${existing.employeeId})`,
  });

  revalidatePath("/staff");

  return ok(null, `Staff member ${existing.name} has been deactivated`);
}

export async function getStaffListAction(
  filters?: { departmentId?: string; status?: string }
): Promise<ActionResult> {
  const session = await requireSession();

  if (!hasPermission(session, "staff", "view")) {
    return fail("You do not have permission to view staff");
  }

  const where: Record<string, any> = { workspaceId: session.workspaceId };

  if (filters?.departmentId) {
    where.departmentId = filters.departmentId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      department: { select: { id: true, name: true } },
    },
    orderBy: { employeeId: "asc" },
  });

  const employeesWithUserStatus = await Promise.all(
    employees.map(async (emp) => {
      const user = await prisma.user.findFirst({
        where: { employeeId: emp.id },
        select: { id: true, status: true, email: true },
      });

      return {
        ...emp,
        userAccount: user,
        deviceSyncStatus: emp.deviceEmployeeId ? "synced" : emp.status === "active" ? "pending" : "inactive",
      };
    })
  );

  await writeAudit({
    session,
    action: "view",
    module: "staff",
    description: `Viewed staff list (${employeesWithUserStatus.length} employees)`,
  });

  return ok(employeesWithUserStatus);
}

export async function resyncEmployeeAction(employeeId: string): Promise<ActionResult> {
  const session = await requireSession();

  if (!hasPermission(session, "staff", "manage")) {
    return fail("You do not have permission to manage staff");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    return fail("Staff member not found");
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return fail("No active attendance device found");
  }

  const result = await syncEmployeeToDevice(
    { id: employee.id, employeeId: employee.employeeId, name: employee.name },
    device.id
  );

  await writeAudit({
    session,
    action: "resync",
    module: "staff",
    recordId: employeeId,
    description: `Resynced employee ${employee.employeeId} to device: ${result.message}`,
  });

  revalidatePath("/staff");

  if (result.success) {
    return ok(null, `Employee ${employee.name} synced successfully`);
  }

  return fail(`Sync failed: ${result.message}`);
}

export async function createEmployeeAction(fd: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!hasPermission(session, "staff", "manage")) return fail("Permission denied");

  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim() || undefined;
  const phone = String(fd.get("phone") || "").trim() || undefined;
  const departmentId = String(fd.get("departmentId") || "").trim() || undefined;
  const positionId = String(fd.get("positionId") || "").trim() || undefined;
  const joinDate = String(fd.get("joinDate") || fd.get("joiningDate") || new Date().toISOString().split("T")[0]);
  const employmentType = String(fd.get("employmentType") || "full_time");
  const baseSalary = parseFloat(String(fd.get("baseSalary") || fd.get("basicSalary") || "0"));
  const address = String(fd.get("address") || "").trim() || undefined;
  const gender = String(fd.get("gender") || "").trim() || undefined;
  const dateOfBirth = String(fd.get("dateOfBirth") || "").trim() || undefined;
  const emergencyPhone = String(fd.get("emergencyPhone") || fd.get("emergencyContact") || "").trim() || undefined;
  const emergencyName = String(fd.get("emergencyName") || fd.get("emergencyContactName") || "").trim() || undefined;

  if (!name) return fail("Name is required");

  const count = await prisma.employee.count({ where: { workspaceId: session.workspaceId } });
  const employeeId = `EMP-${String(count + 1).padStart(3, "0")}`;

  const password = String(fd.get("password") || "Aicnepal@001");
  const hashed = await hashPassword(password);

  const employee = await prisma.employee.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId,
      name,
      email: email || `${employeeId.toLowerCase()}@astrapulse.local`,
      phone,
      departmentId: departmentId || undefined,
      positionId: positionId || undefined,
      joinDate: new Date(joinDate),
      employmentType,
      baseSalary,
      address,
      gender,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      emergencyPhone,
      emergencyName,
      status: "active",
    },
  });

  const role = await prisma.role.findFirst({
    where: { workspaceId: session.workspaceId, name: { contains: "Employee", mode: "insensitive" } },
  });

  const user = await prisma.user.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId: employee.id,
      name,
      email: email || `${employeeId.toLowerCase()}@astrapulse.local`,
      passwordHash: hashed,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "active",
      roleId: role?.id,
    },
  });

  let syncMessage = "Device sync skipped (no device configured)";
  try {
    const device = await prisma.attendanceDevice.findFirst({
      where: { workspaceId: session.workspaceId, isActive: true },
    });
    if (device) {
      const { syncEmployeeToDevice } = await import("@/services/device-sync");
      const result = await syncEmployeeToDevice(
        { id: employee.id, employeeId: employee.employeeId, name: employee.name },
        device.id,
      );
      syncMessage = result.message;
    }
  } catch (e: any) {
    syncMessage = `Device sync error: ${e.message}`;
  }

  await writeAudit({
    session,
    action: "create",
    module: "staff",
    recordId: employee.id,
    description: `Created employee ${employeeId} (${name}). Device sync: ${syncMessage}`,
  });

  revalidatePath("/staff");
  revalidatePath("/departments");
  return ok({ employee, user, syncMessage }, `Employee ${employeeId} created`);
}

export async function updateEmployeeAction(id: string, fd: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!hasPermission(session, "staff", "manage")) return fail("Permission denied");

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return fail("Employee not found");

  const data: any = {};
  for (const [key, val] of Array.from(fd.entries())) {
    if (key === "basicSalary") data[key] = parseFloat(String(val)) || 0;
    else if (key === "joiningDate" || key === "dateOfBirth") data[key] = val ? new Date(String(val)) : undefined;
    else if (val !== null && val !== undefined && String(val).trim() !== "") data[key] = String(val).trim();
  }

  const updated = await prisma.employee.update({ where: { id }, data });

  if (data.name && data.name !== employee.name) {
    await prisma.user.updateMany({
      where: { employeeId: employee.id },
      data: { name: data.name },
    });
  }

  if (data.name && data.name !== employee.name) {
    try {
      const device = await prisma.attendanceDevice.findFirst({
        where: { workspaceId: session.workspaceId, isActive: true },
      });
      if (device && employee.employeeId) {
        const { updateDeviceUser } = await import("@/services/device-sync");
        await updateDeviceUser(
          { ipAddress: device.ipAddress, port: device.port, username: device.username ?? "admin", password: device.password ?? "" },
          employee.employeeId,
          data.name,
        );
      }
    } catch {}
  }

  await writeAudit({
    session,
    action: "update",
    module: "staff",
    recordId: id,
    description: `Updated employee ${employee.employeeId}`,
  });

  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
  return ok(updated, "Employee updated");
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!hasPermission(session, "staff", "manage")) return fail("Permission denied");

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return fail("Employee not found");

  try {
    if (employee.employeeId) {
      const { unsyncEmployeeFromDevice } = await import("@/services/device-sync");
      await unsyncEmployeeFromDevice(employee.employeeId);
    }
  } catch {}

  await prisma.user.deleteMany({ where: { employeeId: id } });
  await prisma.employee.delete({ where: { id } });

  await writeAudit({
    session,
    action: "delete",
    module: "staff",
    recordId: id,
    description: `Deleted employee ${employee.employeeId} (${employee.name})`,
  });

  revalidatePath("/staff");
  return ok(null, `Employee ${employee.employeeId} deleted`);
}

export async function createDepartmentAction(fd: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!hasPermission(session, "department", "manage")) return fail("Permission denied");

  const name = String(fd.get("name") || "").trim();
  const description = String(fd.get("description") || "").trim() || undefined;

  if (!name) return fail("Department name is required");

  const existing = await prisma.department.findFirst({
    where: { workspaceId: session.workspaceId, name },
  });
  if (existing) return fail("Department with this name already exists");

  const department = await prisma.department.create({
    data: { workspaceId: session.workspaceId, name, description },
  });

  await writeAudit({
    session,
    action: "create",
    module: "department",
    recordId: department.id,
    description: `Created department: ${name}`,
  });

  revalidatePath("/departments");
  return ok(department, `Department "${name}" created`);
}

export async function updateDepartmentAction(id: string, fd: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!hasPermission(session, "department", "manage")) return fail("Permission denied");

  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) return fail("Department not found");

  const name = String(fd.get("name") || "").trim();
  const description = String(fd.get("description") || "").trim() || undefined;

  if (!name) return fail("Department name is required");

  const updated = await prisma.department.update({
    where: { id },
    data: { name, description },
  });

  await writeAudit({
    session,
    action: "update",
    module: "department",
    recordId: id,
    description: `Updated department: ${name}`,
  });

  revalidatePath("/departments");
  return ok(updated, `Department "${name}" updated`);
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!hasPermission(session, "department", "manage")) return fail("Permission denied");

  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) return fail("Department not found");

  const empCount = await prisma.employee.count({ where: { departmentId: id } });
  if (empCount > 0) return fail(`Cannot delete: ${empCount} employee(s) still in this department`);

  await prisma.department.delete({ where: { id } });

  await writeAudit({
    session,
    action: "delete",
    module: "department",
    recordId: id,
    description: `Deleted department: ${dept.name}`,
  });

  revalidatePath("/departments");
  return ok(null, `Department "${dept.name}" deleted`);
}
