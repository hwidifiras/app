import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  addHouseholdMemberSchema,
  createHouseholdSchema,
} from "@/lib/schemas/household";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId")?.trim();

  if (memberId) {
    const link = await prisma.householdMember.findUnique({
      where: { memberId },
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
    include: {
      members: {
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
  try {
    await requirePermission(request, "members.manage");
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

  const existing = await prisma.householdMember.findUnique({
    where: { memberId: parsed.data.memberId },
  });
  if (existing) {
    return NextResponse.json({ error: "Ce membre appartient déjà à un foyer" }, { status: 409 });
  }

  try {
    const household = await prisma.household.create({
      data: {
        label: parsed.data.label?.trim() || null,
        members: {
          create: {
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

    return NextResponse.json({ data: household }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur création foyer" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePermission(request, "members.manage");
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

  const existing = await prisma.householdMember.findUnique({
    where: { memberId: addParsed.data.memberId },
  });
  if (existing) {
    return NextResponse.json({ error: "Ce membre appartient déjà à un foyer" }, { status: 409 });
  }

  try {
    const link = await prisma.householdMember.create({
      data: {
        householdId: addParsed.data.householdId,
        memberId: addParsed.data.memberId,
        relationship: addParsed.data.relationship,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        household: { select: { id: true, label: true } },
      },
    });
    return NextResponse.json({ data: link });
  } catch {
    return NextResponse.json({ error: "Erreur ajout au foyer" }, { status: 500 });
  }
}
