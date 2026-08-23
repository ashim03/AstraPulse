"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, ROLE_DEFAULTS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";

async function requirePerm(module: string, action: string = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action as never)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export type RoleData = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
};

export async function getRolesAction(): Promise<ActionResult<RoleData[]>> {
  try {
    const session = await requirePerm("roles", "view");
    const roles = await prisma.role.findMany({
      where: { workspaceId: session.workspaceId },
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });

    const result: RoleData[] = roles.map((r) => {
      let permissions: string[] = [];
      try {
        const parsed = JSON.parse(r.permissions || "[]");
        permissions = Array.isArray(parsed) ? parsed : [];
      } catch {
        permissions = [];
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        permissions,
        isSystem: r.isSystem,
        userCount: r._count.users,
      };
    });

    return ok(result);
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to load roles");
  }
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissions: string[]
): Promise<ActionResult> {
  try {
    const session = await requirePerm("roles", "edit");

    const role = await prisma.role.findFirst({
      where: { id: roleId, workspaceId: session.workspaceId },
    });
    if (!role) return fail("Role not found");

    const before = { permissions: JSON.parse(role.permissions || "[]") };

    await prisma.role.update({
      where: { id: roleId },
      data: { permissions: JSON.stringify(permissions) },
    });

    await writeAudit({
      session,
      action: "edit",
      module: "roles",
      recordId: roleId,
      description: `Updated permissions for role "${role.name}"`,
      before,
      after: { permissions },
    });

    revalidatePath("/settings/roles");
    return ok(undefined, "Role permissions updated");
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to update role permissions");
  }
}

export async function createRoleAction(
  name: string,
  description: string,
  copyFromRoleId?: string
): Promise<ActionResult<RoleData>> {
  try {
    const session = await requirePerm("roles", "create");

    if (!name.trim()) return fail("Role name is required");

    const existing = await prisma.role.findFirst({
      where: { workspaceId: session.workspaceId, name: name.trim() },
    });
    if (existing) return fail("A role with this name already exists");

    let permissions: string[] = [];
    if (copyFromRoleId) {
      const sourceRole = await prisma.role.findFirst({
        where: { id: copyFromRoleId, workspaceId: session.workspaceId },
      });
      if (sourceRole) {
        try {
          const parsed = JSON.parse(sourceRole.permissions || "[]");
          permissions = Array.isArray(parsed) ? [...parsed] : [];
        } catch {
          permissions = [];
        }
      }
    }

    const role = await prisma.role.create({
      data: {
        workspaceId: session.workspaceId,
        name: name.trim(),
        description: description.trim() || null,
        permissions: JSON.stringify(permissions),
        isSystem: false,
      },
    });

    await writeAudit({
      session,
      action: "create",
      module: "roles",
      recordId: role.id,
      description: `Created role "${role.name}"`,
      after: { name: role.name, permissions },
    });

    revalidatePath("/settings/roles");

    const result: RoleData = {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions,
      isSystem: false,
      userCount: 0,
    };

    return ok(result, "Role created");
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to create role");
  }
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("roles", "delete");

    const role = await prisma.role.findFirst({
      where: { id: roleId, workspaceId: session.workspaceId },
      include: { _count: { select: { users: true } } },
    });

    if (!role) return fail("Role not found");
    if (role.isSystem) return fail("Cannot delete a default role");
    if (role._count.users > 0) {
      return fail(`Cannot delete role "${role.name}" — ${role._count.users} user(s) are assigned to it`);
    }

    await prisma.role.delete({ where: { id: roleId } });

    await writeAudit({
      session,
      action: "delete",
      module: "roles",
      recordId: roleId,
      description: `Deleted role "${role.name}"`,
    });

    revalidatePath("/settings/roles");
    return ok(undefined, "Role deleted");
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to delete role");
  }
}

export async function getDefaultPermissionsAction(): Promise<ActionResult<Record<string, string[]>>> {
  try {
    const session = await requirePerm("roles", "view");
    return ok(ROLE_DEFAULTS);
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to load default permissions");
  }
}
