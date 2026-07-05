import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  addHouseholdMemberSchema,
  createHouseholdSchema,
} from "@/lib/schemas/household";

export const runtime = "nodejs";

function householdAuditSnapshot(household: {
  id: string;
  label: string | null;
  members: Array<{
    relationship: string;
    member: { id: string; firstName: string; lastName: string; phone: string };
  }>;
}) {
  return {
    id: household.id,
    label: household.label,
    members: household.members.map((item) => ({
      memberId: item.member.id,
      memberName: `${item.member.firstName} ${item.member.lastName}`.trim(),
      memberPhone: item.member.phone,
      relationship: item.relationship,
    })),
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
  const memberId = searchParams.get("memberId")?.trim();

  if (memberId) {
    const link = await prisma.householdMember.findFirst({
      where: { tenantId: actor.tenantId, memberId },
      include: {
        household: {
          include: {
            members: {
              include: {
                member: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    memberType: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return NextResponse.json({ data: link });
  }

  const households = await prisma.household.findMany({
    where: { tenantId: actor.tenantId },
    include: {
      members: {
        where: { tenantId: actor.tenantId },
        include: {
          member: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: households });
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

  const parsed = createHouseholdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.householdMember.findFirst({
    where: { tenantId: actor.tenantId, memberId: parsed.data.memberId },
  });
  if (existing) {
    return NextResponse.json({ error: "Ce membre appartient déjà à un foyer" }, { status: 409 });
  }

  const member = await prisma.member.findFirst({
    where: { id: parsed.data.memberId, tenantId: actor.tenantId },
    select: { id: true },
  });

  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }

  try {
    const household = await prisma.$transaction(async (tx) => {
      const created = await tx.household.create({
        data: {
          tenantId: actor.tenantId,
          label: parsed.data.label?.trim() || null,
          members: {
            create: {
              tenantId: actor.tenantId,
              memberId: parsed.data.memberId,
              relationship: parsed.data.relationship,
            },
          },
        },
        include: {
          members: {
            include: {
              member: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "HOUSEHOLD_CREATED",
          entityType: "Household",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({ tenantId: actor.tenantId, after: householdAuditSnapshot(created) }),
        },
      });

      return created;
    });

    return NextResponse.json({ data: household }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur création foyer" }, { status: 500 });
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

  const addParsed = addHouseholdMemberSchema.safeParse(body);
  if (!addParsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: addParsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.householdMember.findFirst({
    where: { tenantId: actor.tenantId, memberId: addParsed.data.memberId },
  });
  if (existing) {
    return NextResponse.json({ error: "Ce membre appartient déjà à un foyer" }, { status: 409 });
  }

  const [household, member] = await Promise.all([
    prisma.household.findFirst({
      where: { id: addParsed.data.householdId, tenantId: actor.tenantId },
      select: { id: true },
    }),
    prisma.member.findFirst({
      where: { id: addParsed.data.memberId, tenantId: actor.tenantId },
      select: { id: true },
    }),
  ]);

  if (!household) {
    return NextResponse.json({ error: "Foyer introuvable" }, { status: 404 });
  }

  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }

  try {
    const link = await prisma.$transaction(async (tx) => {
      const created = await tx.householdMember.create({
        data: {
          tenantId: actor.tenantId,
          householdId: addParsed.data.householdId,
          memberId: addParsed.data.memberId,
          relationship: addParsed.data.relationship,
        },
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
          household: { select: { id: true, label: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "HOUSEHOLD_MEMBER_ADDED",
          entityType: "Household",
          entityId: created.householdId,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            householdId: created.householdId,
            householdLabel: created.household.label,
            memberId: created.memberId,
            memberName: `${created.member.firstName} ${created.member.lastName}`.trim(),
            relationship: created.relationship,
          }),
        },
      });

      return created;
    });
    return NextResponse.json({ data: link });
  } catch {
    return NextResponse.json({ error: "Erreur ajout au foyer" }, { status: 500 });
  }
}
