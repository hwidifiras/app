import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getClubSettings } from "@/lib/club-settings";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { enrollmentApplySchema } from "@/lib/schemas/enrollment";
import { familyBundleRulesSchema } from "@/lib/schemas/offer";
import {
  buildEnrollmentQuote,
  checkScheduleConflictForMember,
  ensureSharedHouseholdForMembers,
  isMemberAllowedInGroup,
} from "@/lib/membership-rules";
import { emptyEnrollmentUndoSnapshot } from "@/lib/enrollment-undo";
import { resolveMemberPhone } from "@/lib/member-phone";
import { sendReceiptEmailForReceipt, type ReceiptEmailDeliveryResult } from "@/lib/receipt-email-delivery";
import { withTenantContext } from "@/lib/tenant-context";
import { recordSubscriptionPayment } from "@/modules/finance/payment-service";
import { sellSubscription } from "@/modules/sales/subscription-sale-service";
import {
  IdempotencyKeyConflictError,
  InvalidIdempotencyKeyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  replayIdempotentResponse,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let actor: Awaited<ReturnType<typeof requirePermission>>;
  try {
    actor = await requirePermission(request, "enrollment.sell");
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

  return withTenantContext(
    { tenantId: actor.tenantId, tenantSlug: actor.tenantSlug },
    async () => {
      let idempotencyKey: string | null;
      try {
        idempotencyKey = readIdempotencyKey(request);
      } catch (error) {
        if (error instanceof InvalidIdempotencyKeyError) {
          return NextResponse.json({ error: "Clé d'idempotence invalide" }, { status: 400 });
        }
        throw error;
      }
      const idempotencyParams = {
        tenantId: actor.tenantId,
        scope: "enrollment:apply",
        idempotencyKey,
        requestPayload: parsed.data,
      };
      try {
        const replay = await replayIdempotentResponse<Record<string, unknown>>(idempotencyParams);
        if (replay) {
          return NextResponse.json(replay.response.body, {
            status: replay.response.status,
            headers: idempotencyResponseHeaders(true),
          });
        }
      } catch (error) {
        if (error instanceof IdempotencyKeyConflictError) {
          return NextResponse.json(
            { error: "Cette clé d'idempotence a déjà été utilisée avec une autre requête", code: error.message },
            { status: 409 },
          );
        }
        throw error;
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

      const startDate = parsed.data.startDate
        ? new Date(parsed.data.startDate)
        : new Date();

      try {
        const result = await runIdempotentSerializableTransaction(idempotencyParams, async (tx) => {
          const subscriptionIds: string[] = [];
          const memberIds: string[] = [];
          const receipts: Array<{ id: string; receiptNumber: string }> = [];
          const undoSnapshot = emptyEnrollmentUndoSnapshot();
          const recoveryKey = randomUUID();

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
                  tenantId: actor.tenantId,
                  firstName: line.newMember.firstName,
                  lastName: line.newMember.lastName,
                  phone: memberPhone,
                  email: line.newMember.email?.trim() || null,
                  memberType: line.newMember.memberType,
                  gender: line.newMember.gender,
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

            const member = await tx.member.findFirst({
              where: { id: memberId, tenantId: actor.tenantId },
              select: { id: true, status: true, memberType: true, gender: true },
            });
            if (!member || member.status === "ARCHIVED")
              throw new Error(`LINE_MEMBER_INVALID_${i}`);

            const plan = await tx.subscriptionPlan.findFirst({
              where: { id: line.planId, tenantId: actor.tenantId },
            });
            const group = await tx.group.findFirst({
              where: { id: line.groupId, tenantId: actor.tenantId },
              include: {
                _count: {
                  select: { members: { where: { status: "ACTIVE" } } },
                },
              },
            });
            if (!plan || !group) throw new Error(`LINE_INVALID_${i}`);
            if (!group.isActive) throw new Error(`LINE_GROUP_INACTIVE_${i}`);
            if (plan.sportId !== group.sportId)
              throw new Error(`LINE_SPORT_${i}`);
            if (!isMemberAllowedInGroup(group.groupType, member.memberType, group.genderPolicy, member.gender)) {
              throw new Error(`LINE_MEMBER_TYPE_${i}`);
            }

            const existingAssign = await tx.groupMember.findUnique({
              where: {
                tenantId_groupId_memberId: {
                  tenantId: actor.tenantId,
                  groupId: line.groupId,
                  memberId,
                },
              },
            });

            const addsSeat =
              !existingAssign || existingAssign.status !== "ACTIVE";
            if (addsSeat && group._count.members >= group.capacity) {
              throw new Error(`LINE_CAPACITY_${i}`);
            }

            if (addsSeat) {
              const conflict = await checkScheduleConflictForMember(
                memberId,
                line.groupId,
              );
              if (!conflict.ok) throw new Error(`LINE_SCHEDULE_${i}`);
            }

            const mustCreateFreshSub = !quoteLine.reusesExistingSubscription;

            if (mustCreateFreshSub) {
              const payCents = line.paymentCents ?? 0;
              if (payCents > quoteLine.finalAmountCents) throw new Error(`LINE_OVERPAY_${i}`);
              const expiredActive = await tx.memberSubscription.findMany({
                where: { tenantId: actor.tenantId, memberId, sportId: plan.sportId, status: "ACTIVE" },
                select: { id: true },
              });
              const sale = await sellSubscription(tx, {
                tenantId: actor.tenantId,
                actorId: actor.id,
                memberId,
                plan,
                startDate,
                source: "enrollment",
                amountCents: quoteLine.finalAmountCents,
                listPriceCents: quoteLine.listPriceCents,
                discountCents: quoteLine.discountCents,
                offerName: quote.offerName,
                paymentCents: payCents,
                paymentMethod: line.paymentMethod?.trim() || "CASH",
                paymentNotes: line.paymentNotes,
              });
              const sub = sale.subscription;
              if (
                expiredActive.length > 0 &&
                sub.activationPolicy === "FIXED_DATE" &&
                sub.startDate <= new Date()
              ) {
                undoSnapshot.expiredSubscriptionIds.push(
                  ...expiredActive.map((row) => row.id),
                );
              }
              subscriptionIds.push(sub.id);
              undoSnapshot.createdSubscriptionIds.push(sub.id);
              if (sale.payment) undoSnapshot.createdPaymentIds.push(sale.payment.id);
              if (sale.receipt) {
                receipts.push({ id: sale.receipt.id, receiptNumber: sale.receipt.receiptNumber });
              }
            } else {
              const existing = await tx.memberSubscription.findFirst({
                where: {
                  tenantId: actor.tenantId,
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
                let paymentResult: Awaited<ReturnType<typeof recordSubscriptionPayment>>;
                try {
                  paymentResult = await recordSubscriptionPayment(tx, {
                    tenantId: actor.tenantId,
                    memberSubscriptionId: existing.id,
                    amount: payCents,
                    actorId: actor.id,
                    source: "enrollment-existing-subscription",
                    paymentMethod: line.paymentMethod?.trim() || "CASH",
                    notes: line.paymentNotes,
                  });
                } catch (error) {
                  if (error instanceof Error && error.message === "OVERPAY") {
                    throw new Error(`LINE_OVERPAY_${i}`);
                  }
                  throw error;
                }
                undoSnapshot.createdPaymentIds.push(paymentResult.payment.id);
                receipts.push({
                  id: paymentResult.receipt.id,
                  receiptNumber: paymentResult.receipt.receiptNumber,
                });
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
                data: {
                  status: "ACTIVE",
                  startDate:
                    existingAssign.status === "ACTIVE" && existingAssign.startDate <= startDate
                      ? existingAssign.startDate
                      : startDate,
                  endDate: null,
                },
              });
            } else {
              const groupMember = await tx.groupMember.create({
                data: {
                  tenantId: actor.tenantId,
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
            const offer = await tx.offer.findFirst({
              where: { id: parsed.data.offerId, tenantId: actor.tenantId },
            });
            if (offer?.kind === "FAMILY_BUNDLE" && offer.isActive) {
              const rules = familyBundleRulesSchema.parse(
                JSON.parse(offer.rules),
              );
              if (rules.requiresHousehold) {
                await ensureSharedHouseholdForMembers(tx, memberIds);
              }
            }
          }

          let offerApplicationId: string | null = null;
          if (parsed.data.offerId) {
            const app = await tx.offerApplication.create({
              data: {
                tenantId: actor.tenantId,
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
                where: { tenantId: actor.tenantId, id: { in: subscriptionIds } },
                data: { offerApplicationId: app.id },
              });
            }
          }

          await tx.auditLog.create({
            data: {
              tenantId: actor.tenantId,
              action: "ENROLLMENT_APPLIED",
              entityType: "Enrollment",
              entityId: offerApplicationId ?? memberIds[0] ?? "batch",
              userId: actor.id,
              details: JSON.stringify({
                tenantId: actor.tenantId,
                memberIds,
                subscriptionIds,
                offerId: parsed.data.offerId ?? null,
                offerName: quote.offerName,
                totalFinalCents: quote.totalFinalCents,
                recoveryKey,
                undoSnapshot,
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

          return {
            status: 201,
            body: {
              data: {
                memberIds,
                subscriptionIds,
                offerApplicationId,
                quote,
                receipts,
                undoSnapshot,
                recoveryKey,
              },
            },
          };
        });

        if (result.replayed) {
          return NextResponse.json(result.response.body, {
            status: result.response.status,
            headers: idempotencyResponseHeaders(true),
          });
        }

        const deliveries: ReceiptEmailDeliveryResult[] = [];
        try {
          const settings = await getClubSettings({ tenantId: actor.tenantId });
          if (settings.receiptEmailDefault) {
            for (const receipt of result.response.body.data.receipts) {
              deliveries.push(await sendReceiptEmailForReceipt({
                receiptId: receipt.id,
                tenantId: actor.tenantId,
                requestUrl: request.url,
                actorId: actor.id,
              }));
            }
          }
        } catch (emailError) {
          console.error("[POST /api/enrollment/apply] receipt email error:", emailError);
          deliveries.push({
            delivered: false,
            code: "EMAIL_SEND_FAILED",
            error: "Echec d'envoi email",
            status: 503,
          });
        }

        return NextResponse.json({
          ...result.response.body,
          data: { ...result.response.body.data, receiptEmailDeliveries: deliveries },
        }, { status: result.response.status });
      } catch (error) {
        if (error instanceof IdempotencyKeyConflictError) {
          return NextResponse.json(
            { error: "Cette clé d'idempotence a déjà été utilisée avec une autre requête", code: error.message },
            { status: 409 },
          );
        }
        const msg = error instanceof Error ? error.message : "";
        const lifecycleMessage: Record<string, string> = {
          RENEWAL_ALREADY_QUEUED: "Un renouvellement est déjà planifié pour l'un des membres.",
          CARRY_OVER_REQUIRES_IMMEDIATE_RENEWAL: "Le report de séances exige un renouvellement immédiat.",
          FIRST_USE_GYM_ONLY: "L'activation au premier passage est réservée aux formules salle.",
          PLAN_ENTITLEMENTS_REQUIRED: "Une formule sélectionnée ne contient aucun droit utilisable.",
          CLASS_PLAN_SPORT_REQUIRED: "Une formule cours sélectionnée n'a pas de discipline.",
        };
        if (lifecycleMessage[msg]) {
          return NextResponse.json({ error: lifecycleMessage[msg], code: msg }, { status: 409 });
        }
        if (msg.startsWith("LINE_")) {
          return NextResponse.json(
            { error: "Erreur sur une ligne d'inscription", code: msg },
            { status: 409 },
          );
        }
        console.error("[POST /api/enrollment/apply]", error);
        return NextResponse.json(
          { error: "Erreur lors de l'inscription" },
          { status: 500 },
        );
      }
    },
  );
}
