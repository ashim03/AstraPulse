import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.notification.updateMany({
    where: { id, userId: session.id, workspaceId: session.workspaceId },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}