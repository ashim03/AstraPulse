import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TaskManager } from "./task-manager";
import { ListTodo, CheckCircle2, Timer, CircleDashed } from "lucide-react";
import type { SmartRow } from "@/components/app/smart-table";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await requireSession();
  const [tasks, employees, departments] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId: session.workspaceId },
      include: { assignee: { include: { department: true } }, department: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employee.findMany({ where: { workspaceId: session.workspaceId, status: "active" }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } }),
  ]);

  const open = tasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "completed").length;

  const rows: SmartRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    assignee: t.assignee?.name ?? "Unassigned",
    assigneeId: t.assigneeId ?? "",
    department: t.department?.name ?? "—",
    departmentId: t.departmentId ?? "",
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate ? format(t.dueDate, "yyyy-MM-dd") : "",
    created: format(t.createdAt, "yyyy-MM-dd"),
  }));

  return (
    <>
      <PageHeader title="Tasks" subtitle={`${open} open, ${done} completed`} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Open Tasks" value={open} icon={ListTodo} />
        <StatCard title="In Progress" value={inProgress} icon={Timer} />
        <StatCard title="Completed" value={done} icon={CheckCircle2} />
        <StatCard title="Total" value={tasks.length} icon={CircleDashed} />
      </div>

      <TaskManager
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </>
  );
}