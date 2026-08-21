import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Timeline } from "@/components/ui/timeline";

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const UsersIcon = () => <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />;
const CalendarIcon = () => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />;
const WalletIcon = () => <Icon d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4h-4z" />;
const ReceiptIcon = () => <Icon d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM14 8H8M16 12H8" />;
const FileIcon = () => <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8" />;
const CardIcon = () => <Icon d="M2 5a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5zM2 10h20" />;
const BookIcon = () => <Icon d="M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 004 4.5v15zM4 19.5A2.5 2.5 0 006.5 22H20v-5" />;
const KeyIcon = () => <Icon d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />;
const ClockIcon = () => <Icon d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />;

const moduleIcons: Record<string, React.ReactNode> = {
  staff: <UsersIcon />,
  leave: <CalendarIcon />,
  payroll: <WalletIcon />,
  expenses: <ReceiptIcon />,
  invoices: <FileIcon />,
  payments: <CardIcon />,
  accounting: <BookIcon />,
  auth: <KeyIcon />,
  attendance: <ClockIcon />,
};

export async function RecentActivity({ workspaceId }: { workspaceId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: true },
  });

  return (
    <Card>
      <CardHeader title="Recent Activity" subtitle="Latest events across your workspace" />
      <CardBody>
        <Timeline
          items={logs.map((log) => ({
            id: log.id,
            title: log.description,
            timestamp: log.createdAt,
            actor: log.user ? { name: log.user.name } : undefined,
            icon: moduleIcons[log.module],
            tone: (moduleIcons[log.module] ? "indigo" : "gray") as "indigo" | "gray",
          }))}
        />
      </CardBody>
    </Card>
  );
}