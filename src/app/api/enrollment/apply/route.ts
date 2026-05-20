import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/request-user";
import { enrollmentApplySchema } from "@/lib/schemas/enrollment";
import {
  buildEnrollmentQuote,
  checkScheduleConflictForMember,
  computeEndDate,
  expireActiveSubscriptionForSport,
  isMemberAllowedInGroup,
} from "@/lib/membership-rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = enrollmentApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const quote = await buildEnrollmentQuote(
    parsed.data.lines,
    parsed.data.offerId,
    parsed.data.startDate,
  );

  if (quote.blocked) {
    return NextResponse.json(
      { error: "Inscription bloquée", details: quote },
      { status: 409 },
    );
  }

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const subscriptionIds: string[] = [];
      const memberIds: string[] = [];

      for (let i = 0; i < parsed.data.lines.length; i++) {
        const line = parsed.data.lines[i];
        const quoteLine = quote.lines[i];
        if (!quoteLine || quoteLine.blocked) {
          throw new Error(`LINE_BLOCKED_${i}`);
        }

        let memberId = line.memberId;

        if (!memberId && line.newMember) {
          const created = await tx.member.create({
            data: {
              firstName: line.newMember.firstName,
              lastName: line.newMember.lastName,
              phone: line.newMember.phone,
              email: line.newMember.email?.trim() || null,
              memberType: line.newMember.memberType,
              birthDate: line.newMember.birthDate
                ? new Date(line.newMember.birthDate)
                : null,
              address: line.newMember.address?.trim() || null,
              parentName: line.newMember.parentName?.trim() || null,
              parentPhone: line.newMember.parentPhone?.trim() || null,
              parentAddress: line.newMember.parentAddress?.trim() || null,
            },
          });
          memberId = created.id;
        }

        if (!memberId) throw new Error(`LINE_MEMBER_${i}`);

        memberIds.push(memberId);

        const member = await tx.member.findUnique({
          where: { id: memberId },
          select: { id: true, status: true, memberType: true },
        });
        if (!member || member.status === "ARCHIVED") throw new Error(`LINE_MEMBER_INVALID_${i}`);

        const plan = await tx.subscriptionPlan.findUnique({ where: { id: line.planId } });
        const group = await tx.group.findUnique({
          where: { id: line.groupId },
          include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } },
        });
        if (!plan || !group) throw new Error(`LINE_INVALID_${i}`);
        if (!group.isActive) throw new Error(`LINE_GROUP_INACTIVE_${i}`);
        if (plan.sportId !== group.sportId) throw new Error(`LINE_SPORT_${i}`);
        if (!isMemberAllowedInGroup(group.groupType, member.memberType)) {
          throw new Error(`LINE_MEMBER_TYPE_${i}`);
        }

        const existingAssign = await tx.groupMember.findUnique({
          where: { groupId_memberId: { groupId: line.groupId, memberId } },
        });

        const addsSeat = !existingAssign || existingAssign.status !== "ACTIVE";
        if (addsSeat && group._count.members >= group.capacity) {
          throw new Error(`LINE_CAPACITY_${i}`);
        }

        if (addsSeat) {
          const conflict = await checkScheduleConflictForMember(memberId, line.groupId);
          if (!conflict.ok) throw new Error(`LINE_SCHEDULE_${i}`);
        }

        if (!quoteLine.reusesExistingSubscription) {
          await expireActiveSubscriptionForSport(tx, memberId, plan.sportId);

          const endDate = computeEndDate(startDate, plan.validityDays);
          const sub = await tx.memberSubscription.create({
            data: {
              memberId,
              planId: plan.id,
              sportId: plan.sportId,
              startDate,
              endDate,
              amount: quoteLine.finalAmountCents,
              remainingSessions: plan.totalSessions,
              status: "ACTIVE",
            },
          });
          subscriptionIds.push(sub.id);

          const payCents = line.paymentCents ?? 0;
          if (payCents > 0) {
            if (payCents > quoteLine.finalAmountCents) {
              throw new Error(`LINE_OVERPAY_${i}`);
            }
            await tx.payment.create({
              data: {
                memberSubscriptionId: sub.id,
                amount: payCents,
                paymentMethod: line.paymentMethod?.trim() || "CASH",
                notes: line.paymentNotes?.trim() || null,
              },
            });
          }
        } else {
          const existing = await tx.memberSubscription.findFirst({
            where: {
              memberId,
              sportId: plan.sportId,
              status: "ACTIVE",
            },
            include: { payments: { select: { amount: true } } },
          });
          if (!existing) throw new Error(`LINE_SUB_MISSING_${i}`);
          subscriptionIds.push(existing.id);

          const payCents = line.paymentCents ?? 0;
          if (payCents > 0) {
            const totalPaid = existing.payments.reduce((sum, p) => sum + p.amount, 0);
            if (totalPaid + payCents > existing.amount) {
              throw new Error(`LINE_OVERPAY_${i}`);
            }
            await tx.payment.create({
              data: {
                memberSubscriptionId: existing.id,
                amount: payCents,
                paymentMethod: line.paymentMethod?.trim() || "CASH",
                notes: line.paymentNotes?.trim() || null,
              },
            });
          }
        }

        if (existingAssign) {
          await tx.groupMember.update({
            where: { id: existingAssign.id },
            data: { status: "ACTIVE", startDate, endDate: null },
          });
        } else {
          await tx.groupMember.create({
            data: {
              groupId: line.groupId,
              memberId,
              startDate,
              status: "ACTIVE",
            },
          });
        }
      }

      let offerApplicationId: string | null = null;
      if (parsed.data.offerId) {
        const app = await tx.offerApplication.create({
          data: {
            offerId: parsed.data.offerId,
            memberIds: JSON.stringify(memberIds),
            subscriptionIds: JSON.stringify(subscriptionIds),
            quoteSnapshot: JSON.stringify(quote),
            createdById: actor.id,
          },
        });
        offerApplicationId = app.id;
      }

      await tx.auditLog.create({
        data: {
          action: "ENROLLMENT_APPLIED",
          entityType: "Enrollment",
          entityId: offerApplicationId ?? memberIds[0] ?? "batch",
          userId: actor.id,
          details: JSON.stringify({ memberIds, subscriptionIds, offerId: parsed.data.offerId }),
        },
      });

      return { memberIds, subscriptionIds, offerApplicationId, quote };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("LINE_")) {
      return NextResponse.json({ error: "Erreur sur une ligne d'inscription", code: msg }, { status: 409 });
    }
    console.error("[POST /api/enrollment/apply]", error);
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 });
  }
}
