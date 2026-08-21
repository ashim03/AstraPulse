import { PrismaClient, type Workspace, type User, type BankAccount } from "@prisma/client";

export type SeedContext = {
  prisma: PrismaClient;
  now: Date;
  workspace: Workspace;
  admin: User;
  userIds: Record<string, string>;
  roles: Record<string, string>;
  deptIds: Record<string, string>;
  positionIds: Record<string, string>;
  employeeIds: Record<string, string>;
  accountIds: Record<string, string>;
  customerIds: Record<string, string>;
  vendorIds: Record<string, string>;
  leaveTypeIds: Record<string, string>;
  checking: BankAccount;
  savings: BankAccount;
};

export function dayAt(base: Date, h: number, m = 0): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}