import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { AnnouncementManager, type DepartmentOption } from "./announcement-manager";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "announcements", "view")) redirect("/?error=access_denied");
  const canCreate = hasPermission(session, "announcements", "create");
  const canDelete = hasPermission(session, "announcements", "delete");
  const [announcements, departments] = await Promise.all([
    prisma.announcement.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } }, department: { select: { name: true } } },
    }),
    prisma.department.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    audience: a.audience,
    department: a.department?.name ?? null,
    priority: a.priority,
    author: a.author?.name ?? "System",
    publishDate: a.publishDate?.toISOString().slice(0, 10) ?? null,
    createdAt: a.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" subtitle="Share updates with your team." breadcrumb="Company" />
      <AnnouncementManager rows={rows} departments={departments as DepartmentOption[]} canCreate={canCreate} canDelete={canDelete} />
    </div>
  );
}