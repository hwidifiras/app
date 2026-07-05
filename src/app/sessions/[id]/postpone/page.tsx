import { notFound, redirect } from "next/navigation";

import { weekStartIsoForDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PostponeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    notFound();
  }

  const session = await prisma.session.findFirst({
    where: { id, tenantId: authUser.tenantId },
    select: { id: true, groupId: true, sessionDate: true },
  });

  if (!session) {
    notFound();
  }

  const week = weekStartIsoForDate(session.sessionDate);
  redirect(`/sessions?week=${week}&groupId=${session.groupId}&sessionId=${session.id}`);
}
