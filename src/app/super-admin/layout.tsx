import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SuperAdminSidebar from "./super-admin-sidebar";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.accountType !== "super_admin") redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { workspace: true, role: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <SuperAdminSidebar userName={user.name} />
      <main className="flex-1 pl-[248px]">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
