import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { enrollmentApplySchema } from "@/lib/schemas/enrollment";
import { familyBundleRulesSchema } from "@/lib/schemas/offer";
import {
  buildEnrollmentQuote,
  checkScheduleConflictForMember,
  computeEndDate,
  ensureSharedHouseholdForMembers,
  isMemberAllowedInGroup,
} from "@/lib/membership-rules";
import { emptyEnrollmentUndoSnapshot } from "@/lib/enrollment-undo";
import { resolveMemberPhone } from "@/lib/member-phone";

export const runtime = "nodejs";

function formatPaymentPrefill(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
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
      const undoSnapshot = emptyEnrollmentUndoSnapshot();

      for (let i = 0; i < parsed.data.lines.length; i++) {
        const line = parsed.data.lines[i];
        const quoteLine = quote.lines[i];
        if (!quoteLine || quoteLine.blocked) {
          throw new Error(`LINE_BLOCKED_${i}`);
        }

        let memberId = line.memberId;

        if (!memberId && line.newMember) {
          const memberPhone = resolveMemberPhone({
            memberType: line.newMember.memberType,
            phone: line.newMember.phone,
            parentPhone: line.newMember.parentPhone,
            firstName: line.newMember.firstName,
            lastName: line.newMember.lastName,
          });
          const created = await tx.member.create({
            data: {
              firstName: line.newMember.firstName,
              lastName: line.newMember.lastName,
              phone: memberPhone,
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
          undoSnapshot.createdMemberIds.push(created.id);
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

        const mustCreateFreshSub = !quoteLine.reusesExistingSubscription;

        if (mustCreateFreshSub) {
          const expiredActive = await tx.memberSubscription.findMany({
            where: { memberId, sportId: plan.sportId, status: "ACTIVE" },
            select: { id: true },
          });
          if (expiredActive.length > 0) {
            await tx.memberSubscription.updateMany({
              where: { id: { in: expiredActive.map((row) => row.id) } },
              data: { status: "EXPIRED" },
            });
            undoSnapshot.expiredSubscriptionIds.push(...expiredActive.map((row) => row.id));
          }

          const endDate = computeEndDate(startDate, plan.validityDays);
          const sub = await tx.memberSubscription.create({
            data: {
              memberId,
              planId: plan.id,
              sportId: plan.sportId,
              startDate,
              endDate,
              amount: quoteLine.finalAmountCents,
              listPriceCents: quoteLine.listPriceCents,
              discountCents: quoteLine.discountCents,
              offerName: quote.offerName,
              remainingSessions: plan.totalSessions,
              status: "ACTIVE",
            },
          });
          subscriptionIds.push(sub.id);
          undoSnapshot.createdSubscriptionIds.push(sub.id);

          const payCents = line.paymentCents ?? 0;
          if (payCents > 0) {
            if (payCents > quoteLine.finalAmountCents) {
              throw new Error(`LINE_OVERPAY_${i}`);
            }
            const payment = await tx.payment.create({
              data: {
                memberSubscriptionId: sub.id,
                amount: payCents,
                paymentMethod: line.paymentMethod?.trim() || "CASH",
                notes: line.paymentNotes?.trim() || null,
              },
            });
            undoSnapshot.createdPaymentIds.push(payment.id);
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
            const payment = await tx.payment.create({
              data: {
                memberSubscriptionId: existing.id,
                amount: payCents,
                paymentMethod: line.paymentMethod?.trim() || "CASH",
                notes: line.paymentNotes?.trim() || null,
              },
            });
            undoSnapshot.createdPaymentIds.push(payment.id);
          }
        }

        if (existingAssign) {
          undoSnapshot.reactivatedGroupMembers.push({
            id: existingAssign.id,
            previousStatus: existingAssign.status,
            previousStartDate: existingAssign.startDate.toISOString(),
            previousEndDate: existingAssign.endDate?.toISOString() ?? null,
          });
          await tx.groupMember.update({
            where: { id: existingAssign.id },
            data: { status: "ACTIVE", startDate, endDate: null },
          });
        } else {
          const groupMember = await tx.groupMember.create({
            data: {
              groupId: line.groupId,
              memberId,
              startDate,
              status: "ACTIVE",
            },
          });
          undoSnapshot.createdGroupMemberIds.push(groupMember.id);
        }
      }

      if (parsed.data.offerId) {
        const offer = await tx.offer.findUnique({ where: { id: parsed.data.offerId } });
        if (offer?.kind === "FAMILY_BUNDLE" && offer.isActive) {
          const rules = familyBundleRulesSchema.parse(JSON.parse(offer.rules));
          if (rules.requiresHousehold) {
            await ensureSharedHouseholdForMembers(tx, memberIds);
          }
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
        undoSnapshot.offerApplicationId = app.id;

        if (subscriptionIds.length > 0) {
          await tx.memberSubscription.updateMany({
            where: { id: { in: subscriptionIds } },
            data: { offerApplicationId: app.id },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: "ENROLLMENT_APPLIED",
          entityType: "Enrollment",
          entityId: offerApplicationId ?? memberIds[0] ?? "batch",
          userId: actor.id,
          details: JSON.stringify({
            memberIds,
            subscriptionIds,
            offerId: parsed.data.offerId ?? null,
            offerName: quote.offerName,
            totalFinalCents: quote.totalFinalCents,
            lines: quote.lines.map((l) => ({
              memberName: l.memberName,
              groupName: l.groupName,
              planName: l.planName,
              sportName: l.sportName,
              listPriceCents: l.listPriceCents,
              finalAmountCents: l.finalAmountCents,
              discountCents: l.discountCents,
            })),
          }),
        },
      });

      return { memberIds, subscriptionIds, offerApplicationId, quote, undoSnapshot };
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
