import { StatCard } from "@/components/ui/stat-card";
import { UserCheck, UserX, AlarmClock, Laptop } from "lucide-react";
import type { AttendanceStats as Stats } from "@/services/attendance";

export function AttendanceStats({ stats, employees }: { stats: Stats; employees: number }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <StatCard title="Present" value={stats.present} icon={UserCheck} footer={<p className="text-xs text-slate-400">of {employees} employees</p>} />
      <StatCard title="Absent" value={stats.absent} icon={UserX} footer={<p className="text-xs text-slate-400">{stats.late} arrived late</p>} />
      <StatCard title="Overtime" value={stats.overtime} icon={AlarmClock} footer={<p className="text-xs text-slate-400">employees with OT</p>} />
      <StatCard title="Remote" value={stats.remote} icon={Laptop} />
    </div>
  );
}