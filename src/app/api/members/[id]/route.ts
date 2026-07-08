import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { requireAdmin } from "@/lib/request-user";
import { updateMemberSchema } from "@/lib/schemas/member";
import { expireStaleSubscriptions } from "@/lib/membership-rules";
import { checkGroupMemberCompatibility } from "@/lib/demographics";
import { memberProfileCompletionError } from "@/lib/member-profile-policy";
import { isTechnicalAdmin } from "@/lib/technical-admin";

export const runtime = "nodejs";

type PermanentDeleteBlockers = {
  groupAssignments: number;
  subscriptions: number;
  attendances: number;
  payments: number;
  receipts: number;
};

function hasPermanentDeleteBlockers(blockers: PermanentDeleteBlockers) {
  return blockers.attendances > 0 || blockers.payments > 0 || blockers.receipts > 0;
}

function normalizeConfirmation(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(_request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;

  try {
    const member = await prisma.member.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        groups: {
          where: { tenantId: actor.tenantId, status: "ACTIVE" },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                sport: { select: { name: true } },
                coach: { select: { firstName: true, lastName: true } },
                room: true,
                schedules: { orderBy: { createdAt: "asc" }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
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
        joinedAt: member.joinedAt.toISOString(),
        archivedAt: member.archivedAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        groupMemberships: (
          member.groups as unknown as Array<{
            id: string;
            groupId: string;
            group: {
              name: string;
              sport: { name: string } | null;
              coach: { firstName: string; lastName: string } | null;
              room: string;
              schedules: Array<{
                dayOfWeek: string;
                startTime: string;
                durationMinutes: number;
              }>;
            };
            startDate: Date;
            endDate: Date | null;
            status: string;
          }>
        ).map((gm) => ({
          id: gm.id,
          groupId: gm.groupId,
          groupName: gm.group.name,
          sportName: gm.group.sport?.name ?? null,
          coachName: gm.group.coach
            ? `${gm.group.coach.firstName} ${gm.group.coach.lastName}`
            : null,
          room: gm.group.room,
          schedule: gm.group.schedules[0]
            ? {
                dayOfWeek: gm.group.schedules[0].dayOfWeek,
                startTime: gm.group.schedules[0].startTime,
                durationMinutes: gm.group.schedules[0].durationMinutes,
              }
            : null,
          startDate: gm.startDate.toISOString(),
          endDate: gm.endDate?.toISOString() ?? null,
          status: gm.status,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/members/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mode = new URL(_request.url).searchParams.get("mode");

  if (mode === "test-purge") {
    let admin;
    try {
      admin = await requireAdmin(_request);
    } catch (e) {
      return jsonAuthFailureResponse(e);
    }

    if (!isTechnicalAdmin(admin)) {
      return NextResponse.json({ error: "Accès technique refusé" }, { status: 403 });
    }

    let body: unknown = {};
    try {
      body = await _request.json();
    } catch {
      body = {};
    }

    const confirmation =
      typeof body === "object" && body !== null && "confirmation" in body
        ? String((body as { confirmation?: unknown }).confirmation ?? "")
        : "";
    const reason =
      typeof body === "object" && body !== null && "reason" in body
        ? String((body as { reason?: unknown }).reason ?? "").trim()
        : "";

    try {
      const result = await prisma.$transaction(async (tx) => {
        const member = await tx.member.findFirst({
          where: { id, tenantId: admin.tenantId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
            archivedAt: true,
            householdLink: { select: { householdId: true } },
          },
        });

        if (!member) {
          return { kind: "not-found" as const };
        }

        if (member.status !== "ARCHIVED") {
          return { kind: "not-archived" as const };
        }

        const memberName = `${member.firstName} ${member.lastName}`.trim();
        if (normalizeConfirmation(confirmation) !== normalizeConfirmation(memberName)) {
          return { kind: "bad-confirmation" as const, memberName };
        }

        const subscriptions = await tx.memberSubscription.findMany({
          where: { tenantId: admin.tenantId, memberId: member.id },
          select: { id: true },
        });
        const subscriptionIds = subscriptions.map((subscription) => subscription.id);
        const payments = subscriptionIds.length
          ? await tx.payment.findMany({
              where: { tenantId: admin.tenantId, memberSubscriptionId: { in: subscriptionIds } },
              select: { id: true },
            })
          : [];
        const paymentIds = payments.map((payment) => payment.id);
        const receipts = paymentIds.length
          ? await tx.receipt.findMany({
              where: { tenantId: admin.tenantId, paymentId: { in: paymentIds } },
              select: { id: true },
            })
          : [];
        const receiptIds = receipts.map((receipt) => receipt.id);
        const attendances = await tx.attendance.findMany({
          where: { tenantId: admin.tenantId, memberId: member.id },
          select: { id: true },
        });
        const attendanceIds = attendances.map((attendance) => attendance.id);
        const groupAssignments = await tx.groupMember.findMany({
          where: { tenantId: admin.tenantId, memberId: member.id },
          select: { id: true },
        });
        const groupAssignmentIds = groupAssignments.map((assignment) => assignment.id);
        const householdId = member.householdLink?.householdId ?? null;

        const referencedIds = [
          member.id,
          ...groupAssignmentIds,
          ...subscriptionIds,
          ...paymentIds,
          ...receiptIds,
          ...attendanceIds,
        ];

        await tx.auditLog.deleteMany({
          where: {
            tenantId: admin.tenantId,
            OR: [
              { entityId: { in: referencedIds } },
              ...referencedIds.map((referencedId) => ({
                details: { contains: referencedId },
              })),
            ],
          },
        });

        if (receiptIds.length > 0) {
          await tx.receipt.deleteMany({
            where: { tenantId: admin.tenantId, id: { in: receiptIds } },
          });
        }

        if (paymentIds.length > 0) {
          await tx.payment.deleteMany({
            where: { tenantId: admin.tenantId, id: { in: paymentIds } },
          });
        }

        if (attendanceIds.length > 0) {
          await tx.attendance.deleteMany({
            where: { tenantId: admin.tenantId, id: { in: attendanceIds } },
          });
        }

        if (groupAssignmentIds.length > 0) {
          await tx.groupMember.deleteMany({
            where: { tenantId: admin.tenantId, id: { in: groupAssignmentIds } },
          });
        }

        if (subscriptionIds.length > 0) {
          await tx.memberSubscription.updateMany({
            where: { tenantId: admin.tenantId, id: { in: subscriptionIds } },
            data: { offerApplicationId: null },
          });
          await tx.memberSubscription.deleteMany({
            where: { tenantId: admin.tenantId, id: { in: subscriptionIds } },
          });
        }

        await tx.member.delete({ where: { id: member.id } });

        if (householdId) {
          const remainingHouseholdMembers = await tx.householdMember.count({
            where: { tenantId: admin.tenantId, householdId },
          });
          if (remainingHouseholdMembers === 0) {
            await tx.household.deleteMany({
              where: { tenantId: admin.tenantId, id: householdId },
            });
          }
        }

        const purgedAt = new Date();
        await tx.auditLog.create({
          data: {
            tenantId: admin.tenantId,
            action: "TECHNICAL_TEST_MEMBER_PURGED",
            entityType: "TechnicalCleanup",
            entityId: "test-member-purge",
            userId: admin.id,
            details: JSON.stringify({
              tenantId: admin.tenantId,
              purgedAt: purgedAt.toISOString(),
              reason: reason || "Purge technique de données de test",
              counts: {
                members: 1,
                groupAssignments: groupAssignmentIds.length,
                subscriptions: subscriptionIds.length,
                payments: paymentIds.length,
                receipts: receiptIds.length,
                attendances: attendanceIds.length,
                removedAuditReferences: referencedIds.length,
              },
            }),
          },
        });

        return {
          kind: "purged" as const,
          purgedAt,
          counts: {
            groupAssignments: groupAssignmentIds.length,
            subscriptions: subscriptionIds.length,
            payments: paymentIds.length,
            receipts: receiptIds.length,
            attendances: attendanceIds.length,
          },
        };
      });

      if (result.kind === "not-found") {
        return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
      }

      if (result.kind === "not-archived") {
        return NextResponse.json(
          { error: "Purge technique refusée : résiliez d'abord ce membre." },
          { status: 409 },
        );
      }

      if (result.kind === "bad-confirmation") {
        return NextResponse.json(
          { error: `Confirmation incorrecte. Tapez exactement : ${result.memberName}` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        data: {
          purged: true,
          purgedAt: result.purgedAt.toISOString(),
          counts: result.counts,
        },
      });
    } catch (error) {
      console.error("DELETE /api/members/[id]?mode=test-purge error:", error);
      return NextResponse.json({ error: "Erreur serveur lors de la purge technique" }, { status: 500 });
    }
  }

  if (mode === "permanent") {
    let admin;
    try {
      admin = await requireAdmin(_request);
    } catch (e) {
      return jsonAuthFailureResponse(e);
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const member = await tx.member.findFirst({
          where: { id, tenantId: admin.tenantId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
            householdLink: { select: { householdId: true } },
          },
        });

        if (!member) {
          return { kind: "not-found" as const };
        }

        const [groupAssignments, subscriptions, attendances, payments, receipts] = await Promise.all([
          tx.groupMember.count({ where: { tenantId: admin.tenantId, memberId: id } }),
          tx.memberSubscription.count({ where: { tenantId: admin.tenantId, memberId: id } }),
          tx.attendance.count({ where: { tenantId: admin.tenantId, memberId: id } }),
          tx.payment.count({
            where: {
              tenantId: admin.tenantId,
              memberSubscription: { tenantId: admin.tenantId, memberId: id },
            },
          }),
          tx.receipt.count({
            where: {
              tenantId: admin.tenantId,
              payment: {
                tenantId: admin.tenantId,
                memberSubscription: { tenantId: admin.tenantId, memberId: id },
              },
            },
          }),
        ]);

        const blockers = { groupAssignments, subscriptions, attendances, payments, receipts };
        if (hasPermanentDeleteBlockers(blockers)) {
          return { kind: "blocked" as const, blockers };
        }

        const deletedAt = new Date();
        const householdId = member.householdLink?.householdId ?? null;

        await tx.auditLog.create({
          data: {
            tenantId: admin.tenantId,
            action: "MEMBER_DELETED",
            entityType: "Member",
            entityId: member.id,
            userId: admin.id,
            details: JSON.stringify({
              tenantId: admin.tenantId,
              firstName: member.firstName,
              lastName: member.lastName,
              phone: member.phone,
              email: member.email,
              status: member.status,
              deletedAt: deletedAt.toISOString(),
              reason: "Suppression définitive admin d'un dossier sans historique métier",
            }),
          },
        });

        await tx.groupMember.deleteMany({
          where: { tenantId: admin.tenantId, memberId: member.id },
        });

        await tx.memberSubscription.deleteMany({
          where: { tenantId: admin.tenantId, memberId: member.id },
        });

        await tx.member.delete({ where: { id: member.id } });

        if (householdId) {
          const remainingHouseholdMembers = await tx.householdMember.count({
            where: { tenantId: admin.tenantId, householdId },
          });
          if (remainingHouseholdMembers === 0) {
            await tx.household.deleteMany({
              where: { tenantId: admin.tenantId, id: householdId },
            });
          }
        }

        return {
          kind: "deleted" as const,
          member: {
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
          },
          deletedAt,
        };
      });

      if (result.kind === "not-found") {
        return NextResponse.json(
          { error: "Membre introuvable" },
          { status: 404 },
        );
      }

      if (result.kind === "blocked") {
        return NextResponse.json(
          {
            error:
              "Suppression définitive bloquée : ce membre a déjà un pointage, un paiement ou un reçu. Utilisez la résiliation pour conserver les traces.",
            details: { blockers: result.blockers },
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        data: {
          id: result.member.id,
          deleted: true,
          deletedAt: result.deletedAt.toISOString(),
        },
      });
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: string }).code
          : null;

      if (errorCode === "P2003") {
        return NextResponse.json(
          {
            error:
              "Suppression définitive bloquée : ce membre est encore lié à des données métier. Utilisez la résiliation.",
          },
          { status: 409 },
        );
      }

      console.error("DELETE /api/members/[id]?mode=permanent error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  }

  let actor;
  try {
    actor = await requirePermission(_request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  try {
    const now = new Date();
    const archived = await prisma.$transaction(async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      const member = await tx.member.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
        },
      });

      await tx.groupMember.updateMany({
        where: { tenantId: actor.tenantId, memberId: id, status: "ACTIVE" },
        data: {
          status: "INACTIVE",
          endDate: now,
        },
      });

      await tx.memberSubscription.updateMany({
        where: { tenantId: actor.tenantId, memberId: id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
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
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
            archivedAt: now.toISOString(),
          }),
        },
      });

      return member;
    });

    await expireStaleSubscriptions(id);

    return NextResponse.json({
      data: {
        id: archived.id,
        status: archived.status,
        archivedAt: archived.archivedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : null;

    if ((error instanceof Error && error.message === "MEMBER_NOT_FOUND") || errorCode === "P2025") {
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    if (errorCode === "P2003") {
      return NextResponse.json(
        {
          error:
            "Impossible de résilier ce membre à cause de dépendances liées",
        },
        { status: 409 },
      );
    }

    console.error("DELETE /api/members/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
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
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation echouee",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (payload.firstName !== undefined) updateData.firstName = payload.firstName.trim();
  if (payload.lastName !== undefined) updateData.lastName = payload.lastName.trim();
  if (payload.phone !== undefined) updateData.phone = payload.phone.trim();
  if (payload.memberType !== undefined) updateData.memberType = payload.memberType;
  if (payload.gender !== undefined) updateData.gender = payload.gender;
  if (payload.birthDate !== undefined) updateData.birthDate = new Date(payload.birthDate);
  if (payload.email !== undefined) updateData.email = payload.email ? payload.email.trim() : null;
  if (payload.address !== undefined) updateData.address = payload.address ? payload.address.trim() : null;
  if (payload.parentName !== undefined) updateData.parentName = payload.parentName ? payload.parentName.trim() : null;
  if (payload.parentPhone !== undefined) updateData.parentPhone = payload.parentPhone ? payload.parentPhone.trim() : null;
  if (payload.parentAddress !== undefined) updateData.parentAddress = payload.parentAddress ? payload.parentAddress.trim() : null;

  if (payload.memberType && payload.memberType !== "KID") {
    updateData.parentName = null;
    updateData.parentPhone = null;
    updateData.parentAddress = null;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: {
          memberType: true,
          gender: true,
          parentName: true,
          parentPhone: true,
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

      if (!existing) throw new Error("MEMBER_NOT_FOUND");

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

        const incompatibleAssignment = existing.groups.find(
          (assignment) =>
            !checkGroupMemberCompatibility({
              groupType: assignment.group.groupType,
              genderPolicy: assignment.group.genderPolicy,
              memberType: targetMemberType,
              gender: targetGender,
            }).ok,
        );

        if (incompatibleAssignment) {
          throw new Error(`MEMBER_POLICY_MISMATCH:${incompatibleAssignment.group.name}`);
        }
      }

      const member = await tx.member.update({
        where: { id },
        data: updateData,
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
            fields: Object.keys(updateData),
          }),
        },
      });

      return member;
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        email: updated.email,
        memberType: updated.memberType,
        gender: updated.gender,
        birthDate: updated.birthDate?.toISOString() ?? null,
        address: updated.address ?? null,
        parentName: updated.parentName ?? null,
        parentPhone: updated.parentPhone ?? null,
        parentAddress: updated.parentAddress ?? null,
        status: updated.status,
        joinedAt: updated.joinedAt.toISOString(),
        archivedAt: updated.archivedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (error instanceof Error && error.message.startsWith("MEMBER_POLICY_MISMATCH:")) {
      const groupName = error.message.split(":").slice(1).join(":");
      return NextResponse.json(
        { error: `Modification impossible: l'eleve resterait incompatible avec le cours "${groupName}".` },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message.startsWith("MEMBER_PROFILE_INCOMPLETE:")) {
      const reason = error.message.split(":").slice(1).join(":");
      return NextResponse.json({ error: reason }, { status: 400 });
    }

    console.error("PATCH /api/members/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
