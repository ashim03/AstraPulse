import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { REPORTS } from "@/lib/constants";
import { FileBarChart2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Reports" subtitle="Generate and download financial statements and management reports." breadcrumb="Finance" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.value} href={`/reports/${r.value}`} className="group">
            <Card className="flex h-full items-start gap-3 p-4 transition-shadow hover:shadow-md">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <FileBarChart2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{r.label}</h3>
                   <ArrowRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-indigo-600" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}