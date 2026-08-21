"use client";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from "recharts";
import { CHART_COLORS } from "@/lib/constants";

const GRID = <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color, #e2e8f0)" vertical={false} />;

function ChartTooltip({ active, payload, label, formatter }: TooltipProps<number, string> & { formatter?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:bg-slate-800 px-3 py-2 shadow-popover">
      {label && <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>}
      {payload.map((entry) => (
        <p key={String(entry.name)} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-800">
            {formatter ? formatter(Number(entry.value)) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "#94a3b8" },
  tickMargin: 6,
} as const;

export function TrendChart({
  data,
  xKey,
  series,
  height = 280,
  currency,
  type = "area",
  color = "#4f46e5",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Array<{ key: string; name: string; color?: string }>;
  height?: number;
  currency?: boolean;
  type?: "area" | "line";
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {GRID}
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} width={46} tickFormatter={(v: number) => (currency ? compactCurrency(v) : String(v))} />
          <Tooltip content={<ChartTooltip formatter={(v) => (currency ? formatMoney(v) : String(v))} />} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? CHART_COLORS[i]}
              fill={s.color ?? CHART_COLORS[i]}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {GRID}
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} width={46} tickFormatter={(v: number) => (currency ? compactCurrency(v) : String(v))} />
          <Tooltip content={<ChartTooltip formatter={(v) => (currency ? formatMoney(v) : String(v))} />} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? CHART_COLORS[i]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export function BarChartView({
  data,
  xKey,
  series,
  height = 280,
  currency,
  stacked,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Array<{ key: string; name: string; color?: string }>;
  height?: number;
  currency?: boolean;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={18}>
        {GRID}
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={46} tickFormatter={(v: number) => (currency ? compactCurrency(v) : String(v))} />
        <Tooltip content={<ChartTooltip formatter={(v) => (currency ? formatMoney(v) : String(v))} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color ?? CHART_COLORS[i]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? "a" : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 280,
  currency,
  centerLabel,
}: {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  currency?: boolean;
  centerLabel?: string;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatter={(v) => (currency ? formatMoney(v) : String(v))} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{centerLabel}</span>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color ?? "#4f46e5" }} />
            <span className="text-slate-500">{d.name}</span>
            <span className="font-medium text-slate-700">{currency ? compactCurrency(d.value) : d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function chartMoney(v: number) {
  return formatMoney(v);
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(v);
}

function compactCurrency(v: number) {
  if (Math.abs(v) >= 1000000) return `Rs. ${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `Rs. ${(v / 1000).toFixed(0)}k`;
  return `Rs. ${v}`;
}