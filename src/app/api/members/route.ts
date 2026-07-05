import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createMemberSchema, updateMemberSchema } from "@/lib/schemas/member";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { resolveMemberPhone } from "@/lib/member-phone";
import { issueReceiptForPayment } from "@/lib/receipts";
import { checkGroupMemberCompatibility } from "@/lib/demographics";
import { memberProfileCompletionError } from "@/lib/member-profile-policy";

export const runtime = "nodejs";

type MemberAuditSource = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  memberType: string;
  gender: string;
  birthDate: Date | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  status: string;
  joinedAt: Date;
  archivedAt: Date | null;
};

const memberAuditSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  memberType: true,
  gender: true,
  birthDate: true,
  address: true,
  parentName: true,
  parentPhone: true,
  parentAddress: true,
  status: true,
  joinedAt: true,
  archivedAt: true,
} as const;

function memberAuditSnapshot(member: MemberAuditSource) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    email: member.email,
    memberType: member.memberType,
    gender: member.gender,
    birthDate: member.birthDate?.toISOString() ?? null,
    address: member.address,
    parentName: member.parentName,
    parentPhone: member.parentPhone,
    parentAddress: member.parentAddress,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    archivedAt: member.archivedAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const searchLimit = query ? 20 : 200;

  let members = await prisma.member.findMany({
    where: query
      ? {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { phone: { contains: query } },
          ],
        }
      : { tenantId: actor.tenantId },
    orderBy: { createdAt: "desc" },
    take: query ? 300 : undefined,
    include: {
      groups: {
        where: { tenantId: actor.tenantId, status: "ACTIVE" },
        select: { groupId: true },
      },
      subscriptions: {
        where: { tenantId: actor.tenantId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          amount: true,
          payments: { where: { tenantId: actor.tenantId }, select: { amount: true } },
        },
      },
    },
  });

  if (query) {
    const q = query.toLowerCase();
    const phoneNorm = query.replace(/\s/g, "");
    members = members
      .filter((m) => {
        const full = `${m.firstName} ${m.lastName}`.toLowerCase();
        const phone = m.phone.replace(/\s/g, "");
        return (
          full.includes(q) ||
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          phone.includes(phoneNorm) ||
          m.phone.includes(query)
        );
      })
      .slice(0, searchLimit);
  }

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
      gender: member.gender,
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
  let actor;
  try {
    actor = await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
  const groupIdValue = hasGroupId ? groupId.trim() : "";
  const planIdValue = hasPlanId && typeof subscriptionPlanId === "string" ? subscriptionPlanId.trim() : "";
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

      if (!hasGroupId) {
        throw new Error("GROUP_REQUIRED");
      }

      const [group, plan] = await Promise.all([
        tx.group.findFirst({
          where: { id: groupIdValue, tenantId: actor.tenantId },
          include: { _count: { select: { members: { where: { tenantId: actor.tenantId, status: "ACTIVE" } } } } },
        }),
        tx.subscriptionPlan.findFirst({ where: { id: planIdValue, tenantId: actor.tenantId } }),
      ]);

      if (!group) throw new Error("GROUP_NOT_FOUND");
      if (!group.isActive) throw new Error("GROUP_INACTIVE");
      if (!plan) throw new Error("PLAN_NOT_FOUND");
      if (!plan.isActive) throw new Error("PLAN_INACTIVE");
      const compatibility = checkGroupMemberCompatibility({
        groupType: group.groupType,
        genderPolicy: group.genderPolicy,
        memberType: parsed.data.memberType,
        gender: parsed.data.gender,
      });
      if (!compatibility.ok) throw new Error(compatibility.code);
      if (plan.sportId && plan.sportId !== group.sportId) throw new Error("PLAN_SPORT_MISMATCH");
      if (group._count.members >= group.capacity) throw new Error("GROUP_CAPACITY_REACHED");
      if (paymentCents > plan.price) throw new Error("PAYMENT_EXCEEDS_DUE");

      const memberPhone = resolveMemberPhone({
        memberType: parsed.data.memberType,
        phone: parsed.data.phone,
        parentPhone: parentPhoneValue,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });

      const created = await tx.member.create({
        data: {
          tenantId: actor.tenantId,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: memberPhone,
          email: emailValue,
          memberType: parsed.data.memberType,
          gender: parsed.data.gender,
          birthDate: birthDateValue,
          address: addressValue,
          parentName: parentNameValue,
          parentPhone: parentPhoneValue,
          parentAddress: parentAddressValue,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_CREATED",
          entityType: "Member",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            source: "member-inscription",
            after: memberAuditSnapshot(created),
          }),
        },
      });

      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.validityDays);

      const subscription = await tx.memberSubscription.create({
        data: {
          tenantId: actor.tenantId,
          memberId: created.id,
          planId: planIdValue,
          sportId: plan.sportId,
          startDate: now,
          endDate,
          amount: plan.price,
          remainingSessions: plan.totalSessions,
          status: "ACTIVE",
        },
      });

      const groupMember = await tx.groupMember.create({
        data: {
          tenantId: actor.tenantId,
          groupId: groupIdValue,
          memberId: created.id,
          startDate: now,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GROUP_MEMBER_CREATED",
          entityType: "GroupMember",
          entityId: groupMember.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            source: "member-inscription",
            memberId: created.id,
            groupId: groupIdValue,
            startDate: now.toISOString(),
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_SUBSCRIPTION_CREATED",
          entityType: "MemberSubscription",
          entityId: subscription.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            memberId: created.id,
            planId: planIdValue,
            groupId: groupIdValue,
            amount: plan.price,
            startDate: now.toISOString(),
            source: "member-inscription",
          }),
        },
      });

      if (paymentCents > 0) {
        const payment = await tx.payment.create({
          data: {
            tenantId: actor.tenantId,
            memberSubscriptionId: subscription.id,
            amount: paymentCents,
            createdById: actor.id,
            paymentDate: paymentDateValue ?? new Date(),
            paymentMethod: paymentMethodValue,
            notes: paymentNotesValue,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "PAYMENT_CREATED",
            entityType: "Payment",
            entityId: payment.id,
            userId: actor.id,
            details: JSON.stringify({ tenantId: actor.tenantId, amount: paymentCents, memberId: created.id }),
          },
        });

        const receipt = await issueReceiptForPayment(tx, payment.id, actor.id, actor.tenantId);
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "RECEIPT_ISSUED",
            entityType: "Receipt",
            entityId: receipt.id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              paymentId: payment.id,
              receiptNumber: receipt.receiptNumber,
              source: "member-inscription",
            }),
          },
        });
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

    if (error instanceof Error && error.message === "GROUP_REQUIRED") {
      return NextResponse.json({ error: "Un groupe est obligatoire pour l'inscription" }, { status: 400 });
    }

    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "GROUP_INACTIVE") {
      return NextResponse.json({ error: "Impossible d'inscrire dans un groupe inactif" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "PLAN_INACTIVE") {
      return NextResponse.json({ error: "Impossible d'utiliser un plan inactif" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "AGE_POLICY_MISMATCH") {
      return NextResponse.json({ error: "Age de l'eleve incompatible avec ce groupe" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "GENDER_POLICY_MISMATCH") {
      return NextResponse.json({ error: "Genre de l'eleve incompatible avec ce groupe" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "PLAN_SPORT_MISMATCH") {
      return NextResponse.json({ error: "Le plan choisi n'est pas compatible avec le sport du groupe" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "GROUP_CAPACITY_REACHED") {
      return NextResponse.json({ error: "Capacité du groupe atteinte" }, { status: 409 });
    }

    const message = isDuplicatePhone
      ? "Un membre avec ce téléphone existe déjà"
      : "Erreur serveur lors de la création du membre";

    return NextResponse.json({ error: message }, { status: isDuplicatePhone ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id: memberId, tenantId: actor.tenantId },
        select: {
          ...memberAuditSelect,
          groups: {
            where: { tenantId: actor.tenantId, status: "ACTIVE" },
            select: {
              group: {
                select: {
                  name: true,
                  groupType: true,
                  genderPolicy: true,
                },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      const profileTouched =
        payload.memberType !== undefined ||
        payload.gender !== undefined ||
        payload.parentName !== undefined ||
        payload.parentPhone !== undefined;

      if (profileTouched) {
        const targetMemberType = payload.memberType ?? existing.memberType;
        const targetGender = payload.gender ?? existing.gender;
        const targetParentName = payload.parentName === undefined ? existing.parentName : payload.parentName;
        const targetParentPhone = payload.parentPhone === undefined ? existing.parentPhone : payload.parentPhone;
        const profileError = memberProfileCompletionError({
          memberType: targetMemberType,
          gender: targetGender,
          parentName: targetParentName,
          parentPhone: targetParentPhone,
        });

        if (profileError) {
          throw new Error(`MEMBER_PROFILE_INCOMPLETE:${profileError}`);
        }

        const incompatibleAssignment = existing.groups.find((assignment) => {
          return !checkGroupMemberCompatibility({
            groupType: assignment.group.groupType,
            genderPolicy: assignment.group.genderPolicy,
            memberType: targetMemberType,
            gender: targetGender,
          }).ok;
        });

        if (incompatibleAssignment) {
          throw new Error(`MEMBER_POLICY_MISMATCH:${incompatibleAssignment.group.name}`);
        }
      }

      const member = await tx.member.update({
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
          gender: payload.gender,
          birthDate: payload.birthDate === undefined ? undefined : new Date(payload.birthDate),
          address: payload.address === undefined ? undefined : payload.address?.trim() || null,
          parentName:
            payload.memberType && payload.memberType !== "KID"
              ? null
              : payload.parentName === undefined ? undefined : payload.parentName?.trim() || null,
          parentPhone:
            payload.memberType && payload.memberType !== "KID"
              ? null
              : payload.parentPhone === undefined ? undefined : payload.parentPhone?.trim() || null,
          parentAddress:
            payload.memberType && payload.memberType !== "KID"
              ? null
              : payload.parentAddress === undefined ? undefined : payload.parentAddress?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_UPDATED",
          entityType: "Member",
          entityId: member.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            fields: Object.entries(payload)
              .filter(([, value]) => value !== undefined)
              .map(([field]) => field),
            before: memberAuditSnapshot(existing),
            after: memberAuditSnapshot(member),
          }),
        },
      });

      return member;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (error instanceof Error && error.message.startsWith("MEMBER_POLICY_MISMATCH:")) {
      const groupName = error.message.split(":").slice(1).join(":");
      return NextResponse.json(
        {
          error: `Modification impossible: l'eleve resterait incompatible avec le cours "${groupName}".`,
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message.startsWith("MEMBER_PROFILE_INCOMPLETE:")) {
      const reason = error.message.split(":").slice(1).join(":");
      return NextResponse.json({ error: reason }, { status: 400 });
    }

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
  let actor;
  try {
    actor = await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
      const existing = await tx.member.findFirst({
        where: { id: memberId, tenantId: actor.tenantId },
        include: {
          groups: { where: { tenantId: actor.tenantId, status: "ACTIVE" }, select: { id: true } },
          subscriptions: { where: { tenantId: actor.tenantId, status: "ACTIVE" }, select: { id: true } },
        },
      });

      if (!existing) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      const member = await tx.member.update({
        where: { id: memberId },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
          groups: {
            updateMany: {
              where: { tenantId: actor.tenantId, status: "ACTIVE" },
              data: {
                status: "INACTIVE",
                endDate: now,
              },
            },
          },
          subscriptions: {
            updateMany: {
              where: { tenantId: actor.tenantId, status: "ACTIVE" },
              data: {
                status: "CANCELLED",
                endDate: now,
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_ARCHIVED",
          entityType: "Member",
          entityId: member.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            archivedAt: now.toISOString(),
            activeGroupAssignmentsClosed: existing.groups.length,
            activeSubscriptionsCancelled: existing.subscriptions.length,
          }),
        },
      });

      return member;
    });

    return NextResponse.json({
      data: {
        id: archived.id,
        status: archived.status,
        archivedAt: archived.archivedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de l'archivage" }, { status: 500 });
  }
}
