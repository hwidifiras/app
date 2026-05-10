import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createMemberSchema, updateMemberSchema } from "@/lib/schemas/member";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const members = await prisma.member.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { phone: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      groups: {
        where: { status: "ACTIVE" },
        select: { groupId: true },
      },
      subscriptions: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          amount: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });

  const data = members.map((member) => {
    const subscription = member.subscriptions[0];
    const totalPaid = subscription
      ? subscription.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
    const paymentStatus = subscription
      ? totalPaid >= subscription.amount
        ? "PAID"
        : totalPaid > 0
          ? "PARTIAL"
          : "UNPAID"
      : "UNPAID";

    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      email: member.email,
      memberType: member.memberType,
      birthDate: member.birthDate?.toISOString() ?? null,
      address: member.address ?? null,
      parentName: member.parentName ?? null,
      parentPhone: member.parentPhone ?? null,
      parentAddress: member.parentAddress ?? null,
      status: member.status,
      paymentStatus,
      joinedAt: member.joinedAt.toISOString(),
      archivedAt: member.archivedAt?.toISOString() ?? null,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      groupIds: (member.groups as unknown as Array<{ groupId: string }>).map((g) => g.groupId),
    };
  });

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const emailValue = parsed.data.email?.trim() || null;
  const addressValue = parsed.data.address?.trim() || null;
  const parentNameValue = parsed.data.parentName?.trim() || null;
  const parentPhoneValue = parsed.data.parentPhone?.trim() || null;
  const parentAddressValue = parsed.data.parentAddress?.trim() || null;
  const birthDateValue = new Date(parsed.data.birthDate);
  const { groupId, subscriptionPlanId, paymentAmount, paymentMethod, paymentDate, paymentNotes } = body as Record<string, unknown>;

  const hasGroupId = typeof groupId === "string" && groupId.trim().length > 0;
  const hasPlanId = typeof subscriptionPlanId === "string" && subscriptionPlanId.trim().length > 0;
  const paymentCents = typeof paymentAmount === "number" && Number.isFinite(paymentAmount)
    ? Math.max(0, Math.round(paymentAmount))
    : 0;
  const paymentMethodValue = typeof paymentMethod === "string" && paymentMethod.trim().length > 0
    ? paymentMethod.trim()
    : null;
  const paymentDateValue = typeof paymentDate === "string" && paymentDate.trim().length > 0
    ? new Date(paymentDate)
    : null;
  const paymentNotesValue = typeof paymentNotes === "string" && paymentNotes.trim().length > 0
    ? paymentNotes.trim()
    : null;

  try {
    const member = await prisma.$transaction(async (tx) => {
      if (!hasPlanId) {
        throw new Error("SUBSCRIPTION_PLAN_REQUIRED");
      }

      const created = await tx.member.create({
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone,
          email: emailValue,
          memberType: parsed.data.memberType,
          birthDate: birthDateValue,
          address: addressValue,
          parentName: parentNameValue,
          parentPhone: parentPhoneValue,
          parentAddress: parentAddressValue,
        },
      });

      if (hasGroupId) {
        const group = await tx.group.findUnique({ where: { id: groupId } });
        if (group) {
          await tx.groupMember.create({
            data: {
              groupId,
              memberId: created.id,
              startDate: new Date(),
            },
          });
        }
      }

      if (hasPlanId) {
        const plan = await tx.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } });
        if (plan) {
          const now = new Date();
          const endDate = new Date(now);
          endDate.setDate(endDate.getDate() + plan.validityDays);

          const subscription = await tx.memberSubscription.create({
            data: {
              memberId: created.id,
              planId: subscriptionPlanId,
              startDate: now,
              endDate,
              amount: plan.price,
              remainingSessions: plan.totalSessions,
              status: "ACTIVE",
            },
          });

            await tx.auditLog.create({
              data: {
                action: "MEMBER_SUBSCRIPTION_CREATED",
                entityType: "MemberSubscription",
                entityId: subscription.id,
                details: JSON.stringify({
                  memberId: created.id,
                  planId: subscriptionPlanId,
                  amount: plan.price,
                  startDate: now.toISOString(),
                  source: "member-inscription",
                }),
              },
            });

          if (paymentCents > 0) {
            if (paymentCents > plan.price) {
              throw new Error("PAYMENT_EXCEEDS_DUE");
            }

            const payment = await tx.payment.create({
              data: {
                memberSubscriptionId: subscription.id,
                amount: paymentCents,
                paymentDate: paymentDateValue ?? new Date(),
                paymentMethod: paymentMethodValue,
                notes: paymentNotesValue,
              },
            });

            await tx.auditLog.create({
              data: {
                action: "PAYMENT_CREATED",
                entityType: "Payment",
                entityId: payment.id,
                details: JSON.stringify({ amount: paymentCents, memberId: created.id }),
              },
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    const isDuplicatePhone =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (error instanceof Error && error.message === "PAYMENT_EXCEEDS_DUE") {
      return NextResponse.json({ error: "Le paiement depasse le montant du plan" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "SUBSCRIPTION_PLAN_REQUIRED") {
      return NextResponse.json({ error: "Un plan d'abonnement est obligatoire pour l'inscription" }, { status: 400 });
    }

    const message = isDuplicatePhone
      ? "Un membre avec ce téléphone existe déjà"
      : "Erreur serveur lors de la création du membre";

    return NextResponse.json({ error: message }, { status: isDuplicatePhone ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("memberId" in body)) {
    return NextResponse.json({ error: "memberId requis" }, { status: 400 });
  }

  const memberId = (body as { memberId?: unknown }).memberId;

  if (typeof memberId !== "string" || memberId.trim().length === 0) {
    return NextResponse.json({ error: "memberId invalide" }, { status: 400 });
  }

  const updatePayload = updateMemberSchema.safeParse(
    (body as Record<string, unknown>).payload,
  );

  if (!updatePayload.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: updatePayload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = updatePayload.data;

  try {
    const updated = await prisma.member.update({
      where: { id: memberId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        email:
          payload.email === undefined
            ? undefined
            : payload.email === "" || payload.email === null
              ? null
              : payload.email,
        memberType: payload.memberType,
        birthDate: payload.birthDate === undefined ? undefined : new Date(payload.birthDate),
        address: payload.address === undefined ? undefined : payload.address?.trim() || null,
        parentName: payload.parentName === undefined ? undefined : payload.parentName?.trim() || null,
        parentPhone: payload.parentPhone === undefined ? undefined : payload.parentPhone?.trim() || null,
        parentAddress: payload.parentAddress === undefined ? undefined : payload.parentAddress?.trim() || null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const isDuplicatePhone =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (isDuplicatePhone) {
      return NextResponse.json({ error: "Un membre avec ce téléphone existe déjà" }, { status: 409 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("memberId" in body)) {
    return NextResponse.json({ error: "memberId requis" }, { status: 400 });
  }

  const memberId = (body as { memberId?: unknown }).memberId;

  if (typeof memberId !== "string" || memberId.trim().length === 0) {
    return NextResponse.json({ error: "memberId invalide" }, { status: 400 });
  }

  try {
    const now = new Date();

    const archived = await prisma.$transaction(async (tx) => {
      const member = await tx.member.update({
        where: { id: memberId },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
        },
      });

      await tx.groupMember.updateMany({
        where: {
          memberId,
          status: "ACTIVE",
        },
        data: {
          status: "INACTIVE",
          endDate: now,
        },
      });

      return member;
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de l'archivage" }, { status: 500 });
  }
}
