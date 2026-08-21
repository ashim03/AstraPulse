"use client";

import { TrendChart, BarChartView, DonutChart } from "@/components/charts";

export type DashboardChartsData = {
  attendance: Array<{ date: string; present: number; late: number; remote: number }>;
  payrollTrend: Array<{ label: string; net: number; gross: number }>;
  revenueVsExpense: Array<{ label: string; revenue: number; expense: number }>;
  expenseCategories: Array<{ name: string; value: number }>;
  leaveDistribution: Array<{ name: string; value: number }>;
  departmentHeadcount: Array<{ name: string; value: number }>;
  cashFlow: Array<{ label: string; flow: number }>;
};

export function DashboardCharts({ data }: { data: DashboardChartsData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Attendance Trend" subtitle="Last 30 days">
        <TrendChart
          data={data.attendance}
          xKey="date"
          series={[
            { key: "present", name: "Present", color: "#4f46e5" },
            { key: "late", name: "Late", color: "#f59e0b" },
            { key: "remote", name: "Remote", color: "#06b6d4" },
          ]}
          height={250}
        />
      </ChartCard>

      <ChartCard title="Payroll Trend" subtitle="Net payroll by month">
        <BarChartView
          data={data.payrollTrend}
          xKey="label"
          currency
          series={[
            { key: "net", name: "Net Pay", color: "#4f46e5" },
            { key: "gross", name: "Gross", color: "#a5b4fc" },
          ]}
          height={250}
        />
      </ChartCard>

      <ChartCard title="Revenue vs Expenses" subtitle="Monthly comparison" className="lg:col-span-2">
        <TrendChart
          data={data.revenueVsExpense}
          xKey="label"
          type="line"
          currency
          series={[
            { key: "revenue", name: "Revenue", color: "#10b981" },
            { key: "expense", name: "Expenses", color: "#ef4444" },
          ]}
          height={240}
        />
      </ChartCard>

      <ChartCard title="Expense Categories" subtitle="By category">
        <DonutChart data={data.expenseCategories} currency height={220} />
      </ChartCard>

      <ChartCard title="Department Headcount" subtitle="Team sizes">
        <BarChartView
          data={data.departmentHeadcount}
          xKey="name"
          series={[{ key: "value", name: "Employees", color: "#06b6d4" }]}
          height={220}
        />
      </ChartCard>

      <ChartCard title="Cash Flow" subtitle="Net monthly cash movement">
        <TrendChart
          data={data.cashFlow}
          xKey="label"
          currency
          color="#10b981"
          series={[{ key: "flow", name: "Net cash flow", color: "#10b981" }]}
          height={230}
        />
      </ChartCard>

      <ChartCard title="Leave Distribution" subtitle="Days by leave type">
        <DonutChart data={data.leaveDistribution} height={230} centerLabel={`${data.leaveDistribution.reduce((a, b) => a + b.value, 0)}d`} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, className, children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`card ${className ?? ""}`}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="section-title">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}