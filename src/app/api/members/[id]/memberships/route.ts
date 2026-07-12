import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { expireStaleSubscriptions, getTotalPaid } from "@/lib/membership-rules";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;
  const member = await prisma.member.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: { id: true },
  });

  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }

  await expireStaleSubscriptions(id);

  const subscriptions = await prisma.memberSubscription.findMany({
    where: { tenantId: actor.tenantId, memberId: id },
    include: {
      sport: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true, totalSessions: true } },
      payments: { select: { amount: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const activeBySport = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const paid = getTotalPaid(s.payments);
      return {
        id: s.id,
        sportId: s.sportId,
        sportName: s.sport?.name ?? "Acces salle",
        planName: s.plan.name,
        amount: s.amount,
        listPriceCents: s.listPriceCents,
        discountCents: s.discountCents,
        offerName: s.offerName,
        totalPaid: paid,
        debt: Math.max(0, s.amount - paid),
        remainingSessions: s.remainingSessions,
        endDate: s.endDate?.toISOString() ?? null,
        paymentStatus: paid >= s.amount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
      };
    });

  const totalDebt = subscriptions.reduce((sum, s) => {
    const paid = getTotalPaid(s.payments);
    return sum + Math.max(0, s.amount - paid);
  }, 0);

  return NextResponse.json({
    data: {
      activeBySport,
      totalDebt,
      history: subscriptions,
    },
  });
}
