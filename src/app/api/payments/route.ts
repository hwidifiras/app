import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createPaymentSchema, updatePaymentSchema } from "@/lib/schemas/payment";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberSubscriptionId = searchParams.get("memberSubscriptionId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  let whereClause: Record<string, unknown> = {};

  if (memberSubscriptionId) {
    whereClause = { memberSubscriptionId };
  } else if (memberId) {
    whereClause = {
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
    },
    orderBy: { paymentDate: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: payments });
}

export async function POST(request: Request) {
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
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { memberSubscriptionId, amount, paymentDate, paymentMethod, notes } = parsed.data;

  try {
    const subscription = await prisma.memberSubscription.findUnique({
      where: { id: memberSubscriptionId },
      include: { payments: { select: { amount: true } } },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    const totalPaid = subscription.payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    const newTotal = totalPaid + amount;

    if (newTotal > subscription.amount) {
      return NextResponse.json(
        {
          error: "Dépassement du montant dû",
          details: { totalPaid, amountDue: subscription.amount, attempted: amount },
        },
        { status: 409 },
      );
    }

    const payment = await prisma.payment.create({
      data: {
        memberSubscriptionId,
        amount,
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

    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_CREATED",
        entityType: "Payment",
        entityId: payment.id,
        details: JSON.stringify({ amount, memberSubscriptionId }),
      },
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/payments] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la création du paiement" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  try {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { memberSubscription: { include: { payments: { select: { id: true, amount: true } } } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    if (payload.amount !== undefined) {
      const subscription = existing.memberSubscription;
      const otherPayments = subscription.payments.filter((p) => p.id !== paymentId);
      const totalOther = otherPayments.reduce((sum, p) => sum + p.amount, 0);
      if (totalOther + payload.amount > subscription.amount) {
        return NextResponse.json(
          { error: "Dépassement du montant dû", details: { amountDue: subscription.amount, otherPaid: totalOther, attempted: payload.amount } },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: payload.amount,
        paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : undefined,
        paymentMethod: payload.paymentMethod?.trim() || null,
        notes: payload.notes?.trim() || null,
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

    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_UPDATED",
        entityType: "Payment",
        entityId: paymentId,
        details: JSON.stringify({ payload }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    console.error("[PATCH /api/payments] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la modification du paiement" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

  try {
    await prisma.payment.delete({
      where: { id: paymentId },
    });

    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_DELETED",
        entityType: "Payment",
        entityId: paymentId,
        details: JSON.stringify({ deletedAt: new Date().toISOString() }),
      },
    });

    return NextResponse.json({ data: { id: paymentId } });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
