"use client";

import { Card } from "@/components/ui/card";
import { TrendChart, BarChartView, DonutChart } from "@/components/charts";

export function AnalyticsClient({
  stats,
  revenueByMonth,
  expenseByMonth,
  invoiceByMonth,
  attendanceByMonth,
  headcount,
  categoryBreakdown,
}: {
  stats: { label: string; value: number; prefix: string }[];
  revenueByMonth: { month: string; value: number }[];
  expenseByMonth: { month: string; value: number }[];
  invoiceByMonth: { month: string; value: number }[];
  attendanceByMonth: { month: string; hours: number }[];
  headcount: { name: string; value: number }[];
  categoryBreakdown: { name: string; value: number }[];
}) {
  const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "NPR" });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-100">
              {s.prefix}
              {s.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Revenue vs Expenses</h3>
          <TrendChart
            data={revenueByMonth.map((m, i) => ({ ...m, expenses: expenseByMonth[i]?.value ?? 0 }))}
            xKey="month"
            currency
            series={[
              { key: "value", name: "Revenue", color: "#10b981" },
              { key: "expenses", name: "Expenses", color: "#f43f5e" },
            ]}
          />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Invoiced Amounts</h3>
          <BarChartView data={invoiceByMonth} xKey="month" series={[{ key: "value", name: "Invoiced", color: "#6366f1" }]} currency />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Hours Logged</h3>
          <BarChartView data={attendanceByMonth} xKey="month" series={[{ key: "hours", name: "Hours", color: "#0ea5e9" }]} />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Headcount by Department</h3>
          <DonutChart data={headcount} />
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Expenses by Category</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categoryBreakdown.map((c) => (
            <div key={c.name} className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.name}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmt(c.value)}</p>
            </div>
          ))}
          {categoryBreakdown.length === 0 && <p className="text-sm text-slate-400">No expense data yet.</p>}
        </div>
      </Card>
    </div>
  );
}