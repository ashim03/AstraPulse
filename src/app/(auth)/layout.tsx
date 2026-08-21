import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect("/");
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.25),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            <p className="text-lg font-bold tracking-tight text-white">AstraPulse</p>
          </div>
          <div className="max-w-md">
            <h1 className="text-3xl font-semibold leading-tight text-white">
              Run your entire business in one place.
            </h1>
            <p className="mt-3 text-slate-300">
              HR management, attendance, payroll, accounting, invoicing and financial reports — purpose-built for
              growing teams.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                ["15+", "Business modules"],
                ["7", "Roles & permissions"],
                ["5", "Payroll workflow steps"],
                ["100%", "Data you control"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                  <p className="text-xl font-semibold text-white">{v}</p>
                  <p className="text-xs text-slate-300">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} AstraPulse Inc. All rights reserved.</p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center bg-slate-50 px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}