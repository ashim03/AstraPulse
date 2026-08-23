import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { RoleManager } from "./role-manager";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await requireSession();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { role: true },
  });

  const rolePermissions = parsePermissions(user?.role?.permissions ?? "[]");
  const canManageRoles =
    rolePermissions.includes("*") ||
    rolePermissions.includes("roles:*") ||
    rolePermissions.includes("roles:manage") ||
    rolePermissions.includes("settings:*") ||
    user?.accountType === "super_admin";

  if (!canManageRoles) {
    redirect("/settings");
  }

  const roles = await prisma.role.findMany({
    where: { workspaceId: session.workspaceId },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  const serializedRoles = roles.map((r) => {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage roles and configure access permissions for your team."
        breadcrumb="Settings"
      />
      <RoleManager initialRoles={serializedRoles} />
    </div>
  );
}
