import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { HolidayManager } from "./holiday-manager";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const session = await requireSession();
  if (!hasPermission(session, "holidays", "view")) redirect("/?error=access_denied");
  const canCreate = hasPermission(session, "holidays", "create");
  const canDelete = hasPermission(session, "holidays", "delete");
  const holidays = await prisma.holiday.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { date: "asc" },
  });

  const today = new Date();
  const upcoming = holidays.filter((h) => h.date >= today).length;
  const past = holidays.length - upcoming;
  const recurring = holidays.filter((h) => h.recurring).length;

  return (
    <>
      <PageHeader title="Holidays" subtitle={`${holidays.length} public holidays and company days`} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Holidays" value={holidays.length} icon={CalendarDays} />
        <StatCard title="Upcoming" value={upcoming} footer={<p className="text-xs text-slate-400">{past} already passed</p>} />
        <StatCard title="Recurring" value={recurring} />
      </div>

      <HolidayManager
        initial={holidays.map((h) => ({
          id: h.id,
          name: h.name,
          date: formatDate(h.date),
          recurring: h.recurring,
          region: h.region,
          upcoming: h.date >= today,
        }))}
        canCreate={canCreate}
        canDelete={canDelete}
      />
    </>
  );
}