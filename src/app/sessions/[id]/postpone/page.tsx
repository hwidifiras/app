import { notFound, redirect } from "next/navigation";

import { weekStartIsoForDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PostponeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true, groupId: true, sessionDate: true },
  });

  if (!session) {
    notFound();
  }

  const week = weekStartIsoForDate(session.sessionDate);
  redirect(`/sessions?week=${week}&groupId=${session.groupId}&sessionId=${session.id}`);
}
