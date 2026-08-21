import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { REPORTS, REPORT_PERIODS } from "@/lib/constants";
import { ReportDetailClient } from "./report-detail-client";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: { params: { type: string }; searchParams: { period?: string } }) {
  const session = await requireSession();
  const report = REPORTS.find((r) => r.value === params.type);
  if (!report) notFound();
  const period = REPORT_PERIODS.some((p) => p.value === searchParams.period) ? searchParams.period! : "this-month";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);

  const from =
    period === "last-month" ? startOfLastMonth :
    period === "this-quarter" ? startOfQuarter :
    period === "this-year" ? startOfYear :
    period === "last-year" ? startOfLastYear :
    period === "all" ? new Date(0) :
    startOfMonth;
  const to = period === "last-month" ? startOfMonth : new Date(now.getFullYear() + 5, 11, 31);

  const [invoices, expenses, income, payments, payrolls, accounts, journals] = await Promise.all([
    prisma.invoice.findMany({ where: { workspaceId: session.workspaceId, date: { gte: from, lte: to } }, include: { customer: true } }),
    prisma.expense.findMany({ where: { workspaceId: session.workspaceId, date: { gte: from, lte: to } } }),
    prisma.income.findMany({ where: { workspaceId: session.workspaceId, date: { gte: from, lte: to } } }),
    prisma.payment.findMany({ where: { workspaceId: session.workspaceId, date: { gte: from, lte: to } } }),
    prisma.payroll.findMany({ where: { workspaceId: session.workspaceId, period: { gte: from.toISOString().slice(0, 7), lte: to.toISOString().slice(0, 7) } } }),
    prisma.account.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { code: "asc" } }),
    prisma.journalEntry.findMany({ where: { workspaceId: session.workspaceId, status: "posted", date: { gte: from, lte: to } }, include: { lines: { include: { account: true } } } }),
  ]);

  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let totals: Record<string, unknown> = {};
  let description = "";

  const revenue = income.reduce((s, i) => s + i.amount + i.tax, 0) + invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.total, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount + e.tax, 0);
  const payrollCost = payrolls.reduce((s, p) => s + p.employerCostTotal, 0);

  switch (params.type) {
    case "profit-loss": {
      description = `Income vs expenses for the selected period. Net income = revenue − (expenses + payroll).`;
      const coGs = expenses.filter((e) => ["Travel", "Meals", "Utilities", "Other"].includes(e.category)).reduce((s, e) => s + e.amount, 0);
      const otherExpenses = expenses.reduce((s, e) => s + e.amount, 0) - coGs;
      rows = [
        { account: "Revenue", amount: revenue },
        { account: "Cost of goods & services", amount: -coGs },
        { account: "Other operating expenses", amount: -otherExpenses },
        { account: "Payroll costs", amount: -payrollCost },
      ];
      const net = revenue - expenseTotal - payrollCost;
      totals = { "Net income": net };
      columns = ["account", "amount"];
      break;
    }
    case "balance-sheet": {
      description = "Account balances by category as of today.";
      const groups: Record<string, { code: string; name: string; balance: number }[]> = {};
      for (const a of accounts) {
        groups[a.type] ??= [];
        groups[a.type].push({ code: a.code, name: a.name, balance: a.balance });
      }
      columns = ["category", "code", "name", "balance"];
      for (const [type, items] of Object.entries(groups)) {
        rows.push({ category: type, code: "", name: "", balance: "" });
        for (const item of items) rows.push({ category: "", code: item.code, name: item.name, balance: item.balance });
      }
      break;
    }
    case "cash-flow": {
      description = "Cash received vs cash paid out.";
      const inflow = payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
      const outflow = payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);
      rows = [
        { flow: "Cash in", amount: inflow },
        { flow: "Cash out", amount: outflow },
      ];
      totals = { "Net cash flow": inflow - outflow };
      columns = ["flow", "amount"];
      break;
    }
    case "trial-balance": {
      description = "Sum of posted debits and credits by account.";
      const map = new Map<string, { code: string; name: string; debit: number; credit: number }>();
      for (const j of journals) {
        for (const l of j.lines) {
          const key = l.account.id;
          const cur = map.get(key) ?? { code: l.account.code, name: l.account.name, debit: 0, credit: 0 };
          cur.debit += l.debit;
          cur.credit += l.credit;
          map.set(key, cur);
        }
      }
      rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
      const td = rows.reduce((s, r) => s + (r.debit as number), 0);
      const tc = rows.reduce((s, r) => s + (r.credit as number), 0);
      totals = { "Total debits": td, "Total credits": tc };
      columns = ["code", "name", "debit", "credit"];
      break;
    }
    case "general-ledger": {
      description = "All posted journal entries in the period.";
      rows = journals.map((j) => ({
        number: j.number,
        date: j.date.toISOString().slice(0, 10),
        description: j.description,
        lines: j.lines.map((l) => `${l.account.code} ${l.account.name} ${l.debit ? `DR ${l.debit}` : `CR ${l.credit}`}`).join("; "),
      }));
      columns = ["number", "date", "description", "lines"];
      break;
    }
    case "accounts-receivable": {
      description = "Invoices not yet fully paid.";
      rows = invoices
        .filter((i) => !["paid", "cancelled", "draft"].includes(i.status) && i.total - i.paid > 0)
        .map((i) => ({ number: i.number, customer: i.customer.name, date: i.date.toISOString().slice(0, 10), total: i.total, paid: i.paid, balance: i.total - i.paid }));
      totals = { "Total outstanding": rows.reduce((s, r) => s + (r.balance as number), 0) };
      columns = ["number", "customer", "date", "total", "paid", "balance"];
      break;
    }
    case "accounts-payable": {
      description = "Expenses not yet paid.";
      rows = expenses
        .filter((e) => e.status !== "paid" && e.status !== "rejected")
        .map((e) => ({ number: e.number, category: e.category, date: e.date.toISOString().slice(0, 10), amount: e.amount, status: e.status }));
      totals = { "Total payable": rows.reduce((s, r) => s + (r.amount as number), 0) };
      columns = ["number", "category", "date", "amount", "status"];
      break;
    }
    case "expense-report": {
      description = "Expenses grouped by category.";
      const byCat = new Map<string, number>();
      for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount + e.tax);
      rows = Array.from(byCat.entries()).map(([category, amount]) => ({ category, amount }));
      totals = { "Total": rows.reduce((s, r) => s + (r.amount as number), 0) };
      columns = ["category", "amount"];
      break;
    }
    case "revenue-report": {
      description = "Income and invoice revenue grouped by category.";
      const byCat = new Map<string, number>();
      for (const i of income) byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.amount + i.tax);
      for (const inv of invoices) {
        if (inv.status === "cancelled") continue;
        byCat.set("Invoiced", (byCat.get("Invoiced") ?? 0) + inv.total);
      }
      rows = Array.from(byCat.entries()).map(([category, amount]) => ({ category, amount }));
      totals = { "Total": rows.reduce((s, r) => s + (r.amount as number), 0) };
      columns = ["category", "amount"];
      break;
    }
    case "payroll-cost": {
      description = "Payroll runs and their costs.";
      rows = payrolls.map((p) => ({ period: p.period, status: p.status, gross: p.grossTotal, net: p.netTotal, employer: p.employerCostTotal }));
      totals = { "Total employer cost": rows.reduce((s, r) => s + (r.employer as number), 0) };
      columns = ["period", "status", "gross", "net", "employer"];
      break;
    }
    case "tax-summary": {
      description = "Tax collected on invoices, income, and expenses.";
      const invoiceTax = invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.tax, 0);
      const incomeTax = income.reduce((s, i) => s + i.tax, 0);
      const expenseTax = expenses.reduce((s, e) => s + e.tax, 0);
      const payrollTax = payrolls.reduce((s, p) => s + p.taxTotal, 0);
      rows = [
        { source: "Invoices", tax: invoiceTax },
        { source: "Other income", tax: incomeTax },
        { source: "Expenses (input)", tax: expenseTax },
        { source: "Payroll (employee tax)", tax: payrollTax },
      ];
      totals = { "Total": rows.reduce((s, r) => s + (r.tax as number), 0) };
      columns = ["source", "tax"];
      break;
    }
    default:
      notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.label}
        subtitle={description}
        breadcrumb={<>{"Reports"} / {report.label}</>}
        actions={<ReportDetailClient period={period} />}
      />
      <Card className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
              {columns.map((c) => (
                <th key={c} className="px-4 py-2 capitalize">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-50">
                {columns.map((c) => (
                  <td key={c} className="px-4 py-2 text-slate-700">
                    {typeof r[c] === "number" ? money(r[c] as number) : (r[c] as string) || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-400">No data for this period.</td></tr>
            )}
          </tbody>
          {Object.keys(totals).length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={Math.max(1, columns.length - 1)} className="px-4 py-2 text-right font-semibold text-slate-800">{Object.keys(totals).join(" / ")}</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">{money(Object.values(totals)[0] as number)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}