import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createPaymentSchema, updatePaymentSchema } from "@/lib/schemas/payment";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  getEffectivePaymentAmount,
  getSubscriptionLedgerTotal,
  validateLedgerTotal,
} from "@/lib/payment-ledger";
import { issueReceiptForPayment, voidReceiptForPayment } from "@/lib/receipts";
import { getClubSettings } from "@/lib/club-settings";
import { sendReceiptEmailForReceipt, type ReceiptEmailDeliveryResult } from "@/lib/receipt-email-delivery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "payments.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const memberSubscriptionId = searchParams.get("memberSubscriptionId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  let whereClause: Record<string, unknown> = { tenantId: actor.tenantId };

  if (memberSubscriptionId) {
    whereClause = { tenantId: actor.tenantId, memberSubscriptionId };
  } else if (memberId) {
    whereClause = {
      tenantId: actor.tenantId,
      memberSubscription: { memberId },
    };
  }

  const payments = await prisma.payment.findMany({
    where: whereClause,
    include: {
      memberSubscription: {
        select: {
          id: true,
          member: { select: { id: true, firstName: true, lastName: true } },
          plan: { select: { id: true, name: true } },
        },
      },
      receipt: {
        select: {
          id: true,
          receiptNumber: true,
          status: true,
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: payments });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "payments.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation echouee",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { memberSubscriptionId, amount, paymentDate, paymentMethod, notes } = parsed.data;

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const subscription = await tx.memberSubscription.findFirst({
        where: { id: memberSubscriptionId, tenantId: actor.tenantId },
        select: { id: true, amount: true },
      });

      if (!subscription) {
        throw new Error("SUB_NOT_FOUND");
      }

      const totalPaid = await getSubscriptionLedgerTotal(tx, memberSubscriptionId);
      const newTotal = totalPaid + amount;
      const totalCheck = validateLedgerTotal(newTotal, subscription.amount);

      if (!totalCheck.ok) {
        throw new Error("OVERPAY");
      }

      const created = await tx.payment.create({
        data: {
          tenantId: actor.tenantId,
          memberSubscriptionId,
          amount,
          entryType: "PAYMENT",
          createdById: actor.id,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod?.trim() || null,
          notes: notes?.trim() || null,
        },
        include: {
          memberSubscription: {
            select: {
              id: true,
              member: { select: { id: true, firstName: true, lastName: true } },
              plan: { select: { id: true, name: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "PAYMENT_CREATED",
          entityType: "Payment",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            amount,
            memberSubscriptionId,
            totalBefore: totalPaid,
            totalAfter: newTotal,
          }),
        },
      });

      const receipt = await issueReceiptForPayment(tx, created.id, actor.id);

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "RECEIPT_ISSUED",
          entityType: "Receipt",
          entityId: receipt.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            paymentId: created.id,
            receiptNumber: receipt.receiptNumber,
          }),
        },
      });

      return { ...created, receipt };
    });

    let receiptEmailDelivery: ReceiptEmailDeliveryResult | null = null;
    try {
      const settings = await getClubSettings();
      if (settings.receiptEmailDefault && payment.receipt?.id) {
        receiptEmailDelivery = await sendReceiptEmailForReceipt({
          receiptId: payment.receipt.id,
          tenantId: actor.tenantId,
          requestUrl: request.url,
          actorId: actor.id,
        });
      }
    } catch (emailError) {
      console.error("[POST /api/payments] receipt email error:", emailError);
      receiptEmailDelivery = {
        delivered: false,
        code: "EMAIL_SEND_FAILED",
        error: "Echec d'envoi email",
        status: 503,
      };
    }

    return NextResponse.json({ data: { ...payment, receiptEmailDelivery } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SUB_NOT_FOUND") {
        return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
      }
      if (error.message === "OVERPAY") {
        return NextResponse.json({ error: "Depassement du montant du" }, { status: 409 });
      }
    }
    console.error("[POST /api/payments] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la creation du paiement" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "payments.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Seul un administrateur peut corriger un paiement" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("paymentId" in body)) {
    return NextResponse.json({ error: "paymentId requis" }, { status: 400 });
  }

  const paymentId = (body as { paymentId?: unknown }).paymentId;

  if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
    return NextResponse.json({ error: "paymentId invalide" }, { status: 400 });
  }

  const parsed = updatePaymentSchema.safeParse((body as Record<string, unknown>).payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation echouee", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  try {
    const correction = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { id: paymentId, tenantId: actor.tenantId },
        include: {
          memberSubscription: {
            select: {
              id: true,
              amount: true,
              member: { select: { id: true, firstName: true, lastName: true } },
              plan: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!existing) throw new Error("PAYMENT_NOT_FOUND");
      if (existing.entryType !== "PAYMENT") throw new Error("LEDGER_ENTRY_IMMUTABLE");

      const effectiveBefore = await getEffectivePaymentAmount(tx, paymentId);
      const correctedAmount = payload.amount ?? effectiveBefore;
      const delta = correctedAmount - effectiveBefore;
      const totalBefore = await getSubscriptionLedgerTotal(tx, existing.memberSubscriptionId);
      const totalAfter = totalBefore + delta;
      const totalCheck = validateLedgerTotal(totalAfter, existing.memberSubscription.amount);

      if (!totalCheck.ok) {
        throw new Error(totalAfter < 0 ? "NEGATIVE_TOTAL" : "OVERPAY");
      }

      const created = await tx.payment.create({
        data: {
          tenantId: actor.tenantId,
          memberSubscriptionId: existing.memberSubscriptionId,
          amount: delta,
          entryType: "CORRECTION",
          correctsPaymentId: existing.id,
          correctionReason: payload.correctionReason.trim(),
          createdById: actor.id,
          paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : new Date(),
          paymentMethod:
            payload.paymentMethod === undefined ? existing.paymentMethod : payload.paymentMethod.trim() || null,
          notes: payload.notes === undefined ? existing.notes : payload.notes.trim() || null,
        },
        include: {
          memberSubscription: {
            select: {
              id: true,
              member: { select: { id: true, firstName: true, lastName: true } },
              plan: { select: { id: true, name: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "PAYMENT_CORRECTED",
          entityType: "Payment",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            originalPaymentId: paymentId,
            reason: payload.correctionReason.trim(),
            amountBefore: effectiveBefore,
            amountAfter: correctedAmount,
            delta,
            totalBefore,
            totalAfter,
            payload,
          }),
        },
      });

      const voidedReceipt = await voidReceiptForPayment(tx, existing.id, payload.correctionReason.trim());
      if (voidedReceipt) {
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "RECEIPT_VOIDED",
            entityType: "Receipt",
            entityId: voidedReceipt.id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              paymentId: existing.id,
              reason: payload.correctionReason.trim(),
              source: "payment-correction",
            }),
          },
        });
      }

      return created;
    });

    return NextResponse.json({ data: correction });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
      }
      if (error.message === "LEDGER_ENTRY_IMMUTABLE") {
        return NextResponse.json({ error: "Seul un paiement original peut etre corrige" }, { status: 409 });
      }
      if (error.message === "OVERPAY") {
        return NextResponse.json({ error: "Depassement du montant du" }, { status: 409 });
      }
      if (error.message === "NEGATIVE_TOTAL") {
        return NextResponse.json({ error: "Le total des paiements ne peut pas devenir negatif" }, { status: 409 });
      }
    }

    console.error("[PATCH /api/payments] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la modification du paiement" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "payments.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Seul un administrateur peut annuler un paiement" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("paymentId" in body)) {
    return NextResponse.json({ error: "paymentId requis" }, { status: 400 });
  }

  const paymentId = (body as { paymentId?: unknown }).paymentId;
  const correctionReason = (body as { correctionReason?: unknown }).correctionReason;

  if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
    return NextResponse.json({ error: "paymentId invalide" }, { status: 400 });
  }

  if (typeof correctionReason !== "string" || correctionReason.trim().length < 3) {
    return NextResponse.json({ error: "Motif obligatoire pour annuler un paiement" }, { status: 400 });
  }

  try {
    const reversal = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { id: paymentId, tenantId: actor.tenantId },
        include: {
          memberSubscription: {
            select: {
              id: true,
              amount: true,
              member: { select: { id: true, firstName: true, lastName: true } },
              plan: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!existing) throw new Error("PAYMENT_NOT_FOUND");
      if (existing.entryType !== "PAYMENT") throw new Error("LEDGER_ENTRY_IMMUTABLE");

      const effectiveAmount = await getEffectivePaymentAmount(tx, paymentId);
      if (effectiveAmount <= 0) {
        throw new Error("PAYMENT_ALREADY_REVERSED");
      }

      const totalBefore = await getSubscriptionLedgerTotal(tx, existing.memberSubscriptionId);
      const totalAfter = totalBefore - effectiveAmount;
      const totalCheck = validateLedgerTotal(totalAfter, existing.memberSubscription.amount);

      if (!totalCheck.ok) {
        throw new Error(totalAfter < 0 ? "NEGATIVE_TOTAL" : "OVERPAY");
      }

      const created = await tx.payment.create({
        data: {
          tenantId: actor.tenantId,
          memberSubscriptionId: existing.memberSubscriptionId,
          amount: -effectiveAmount,
          entryType: "REVERSAL",
          correctsPaymentId: existing.id,
          correctionReason: correctionReason.trim(),
          createdById: actor.id,
          paymentDate: new Date(),
          paymentMethod: existing.paymentMethod,
          notes: existing.notes,
        },
        include: {
          memberSubscription: {
            select: {
              id: true,
              member: { select: { id: true, firstName: true, lastName: true } },
              plan: { select: { id: true, name: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "PAYMENT_REVERSED",
          entityType: "Payment",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            originalPaymentId: paymentId,
            reason: correctionReason.trim(),
            reversedAmount: effectiveAmount,
            totalBefore,
            totalAfter,
          }),
        },
      });

      const voidedReceipt = await voidReceiptForPayment(tx, existing.id, correctionReason.trim());
      if (voidedReceipt) {
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "RECEIPT_VOIDED",
            entityType: "Receipt",
            entityId: voidedReceipt.id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              paymentId: existing.id,
              reason: correctionReason.trim(),
              source: "payment-reversal",
            }),
          },
        });
      }

      return created;
    });

    return NextResponse.json({ data: reversal });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
      }
      if (error.message === "LEDGER_ENTRY_IMMUTABLE") {
        return NextResponse.json({ error: "Seul un paiement original peut etre annule" }, { status: 409 });
      }
      if (error.message === "PAYMENT_ALREADY_REVERSED") {
        return NextResponse.json({ error: "Ce paiement est deja annule" }, { status: 409 });
      }
      if (error.message === "NEGATIVE_TOTAL") {
        return NextResponse.json({ error: "Le total des paiements ne peut pas devenir negatif" }, { status: 409 });
      }
    }

    console.error("[DELETE /api/payments] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de l'annulation du paiement" }, { status: 500 });
  }
}
