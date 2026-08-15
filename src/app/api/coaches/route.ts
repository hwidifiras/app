import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createCoachSchema, updateCoachSchema } from "@/lib/schemas/coach";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { normalizeCoachSportIds } from "@/lib/coach-qualification-policy";
import { buildCoachDto } from "@/lib/coach-view-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activeCoachGroupInclude(referenceDate = new Date(), tenantId?: string) {
  return {
    where: { ...(tenantId ? { tenantId } : {}), isActive: true },
    select: {
      id: true,
      name: true,
      room: true,
      sport: { select: { name: true } },
      schedules: {
        where: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: referenceDate } }] },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" as const },
  };
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const now = new Date();

  const coaches = await prisma.coach.findMany({
    where: query
      ? {
          tenantId: actor.tenantId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { phone: { contains: query } },
            { sport: { is: { name: { contains: query } } } },
            { qualifications: { some: { sport: { name: { contains: query } } } } },
          ],
        }
      : { tenantId: actor.tenantId },
    include: {
      sport: { select: { id: true, name: true } },
      qualifications: {
        include: { sport: { select: { id: true, name: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      groups: activeCoachGroupInclude(now, actor.tenantId),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: coaches.map(buildCoachDto) });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createCoachSchema.safeParse(body);

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
  const birthDateValue = parsed.data.birthDate ? new Date(parsed.data.birthDate) : null;
  const sportIdValue = parsed.data.sportId && parsed.data.sportId.trim().length > 0 ? parsed.data.sportId : null;
  const qualifiedSportIds = normalizeCoachSportIds(parsed.data.qualifiedSportIds, sportIdValue);

  if (qualifiedSportIds.length > 0) {
    const foundSports = await prisma.sport.findMany({
      where: { tenantId: actor.tenantId, id: { in: qualifiedSportIds }, isActive: true },
      select: { id: true },
    });
    if (foundSports.length !== qualifiedSportIds.length) {
      return NextResponse.json({ error: "Sport de spécialité introuvable" }, { status: 404 });
    }
  }

  try {
    const coach = await prisma.$transaction(async (tx) => {
      const created = await tx.coach.create({
        data: {
          tenantId: actor.tenantId,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone,
          email: emailValue,
          birthDate: birthDateValue,
          sportId: sportIdValue,
          qualifications: {
            create: qualifiedSportIds.map((qualifiedSportId) => ({
              tenantId: actor.tenantId,
              sportId: qualifiedSportId,
              isPrimary: qualifiedSportId === sportIdValue,
            })),
          },
        },
        include: {
          sport: { select: { id: true, name: true } },
          qualifications: {
            include: { sport: { select: { id: true, name: true } } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          groups: activeCoachGroupInclude(new Date(), actor.tenantId),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "COACH_CREATED",
          entityType: "Coach",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({ after: buildCoachDto(created) }),
        },
      });

      return created;
    });

    return NextResponse.json({ data: buildCoachDto(coach) }, { status: 201 });
  } catch (error) {
    const isDuplicatePhone =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    const message = isDuplicatePhone
      ? "Un coach avec ce téléphone existe déjà"
      : "Erreur serveur lors de la création du coach";

    return NextResponse.json({ error: message }, { status: isDuplicatePhone ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("coachId" in body)) {
    return NextResponse.json({ error: "coachId requis" }, { status: 400 });
  }

  const coachId = (body as { coachId?: unknown }).coachId;

  if (typeof coachId !== "string" || coachId.trim().length === 0) {
    return NextResponse.json({ error: "coachId invalide" }, { status: 400 });
  }

  const updatePayload = updateCoachSchema.safeParse((body as Record<string, unknown>).payload);

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
  const birthDateValue =
    payload.birthDate === undefined ? undefined : payload.birthDate ? new Date(payload.birthDate) : null;
  const sportIdValue =
    payload.sportId === undefined ? undefined : payload.sportId && payload.sportId.trim().length > 0 ? payload.sportId : null;
  const qualificationReplacementIds =
    payload.qualifiedSportIds === undefined
      ? undefined
      : normalizeCoachSportIds(payload.qualifiedSportIds, sportIdValue === undefined ? undefined : sportIdValue);
  const sportIdsToValidate = normalizeCoachSportIds(
    qualificationReplacementIds,
    sportIdValue === undefined ? undefined : sportIdValue,
  );

  if (sportIdsToValidate.length > 0) {
    const foundSports = await prisma.sport.findMany({
      where: { tenantId: actor.tenantId, id: { in: sportIdsToValidate }, isActive: true },
      select: { id: true },
    });
    if (foundSports.length !== sportIdsToValidate.length) {
      return NextResponse.json({ error: "Sport de spécialité introuvable" }, { status: 404 });
    }
  }

  try {
    const before = await prisma.coach.findFirst({
      where: { id: coachId, tenantId: actor.tenantId },
      include: {
        sport: { select: { id: true, name: true } },
        qualifications: {
          include: { sport: { select: { id: true, name: true } } },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        groups: activeCoachGroupInclude(new Date(), actor.tenantId),
      },
    });

    if (!before) {
      return NextResponse.json({ error: "Coach introuvable" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.coach.update({
        where: { id: coachId },
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
          birthDate: birthDateValue,
          sportId: sportIdValue,
          isActive: payload.isActive,
        },
      });

      if (qualificationReplacementIds !== undefined) {
        await tx.coachSportQualification.deleteMany({ where: { tenantId: actor.tenantId, coachId } });
        if (qualificationReplacementIds.length > 0) {
          await tx.coachSportQualification.createMany({
            data: qualificationReplacementIds.map((qualifiedSportId) => ({
              tenantId: actor.tenantId,
              coachId,
              sportId: qualifiedSportId,
              isPrimary: qualifiedSportId === sportIdValue,
            })),
          });
        }
      } else if (sportIdValue !== undefined) {
        await tx.coachSportQualification.updateMany({
          where: { tenantId: actor.tenantId, coachId },
          data: { isPrimary: false },
        });
        if (sportIdValue) {
          await tx.coachSportQualification.upsert({
            where: { tenantId_coachId_sportId: { tenantId: actor.tenantId, coachId, sportId: sportIdValue } },
            create: { tenantId: actor.tenantId, coachId, sportId: sportIdValue, isPrimary: true },
            update: { isPrimary: true },
          });
        }
      }

      const next = await tx.coach.findFirstOrThrow({
        where: { id: coachId, tenantId: actor.tenantId },
        include: {
          sport: { select: { id: true, name: true } },
          qualifications: {
            include: { sport: { select: { id: true, name: true } } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          groups: activeCoachGroupInclude(new Date(), actor.tenantId),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "COACH_UPDATED",
          entityType: "Coach",
          entityId: coachId,
          userId: actor.id,
          details: JSON.stringify({
            before: buildCoachDto(before),
            after: buildCoachDto(next),
          }),
        },
      });

      return next;
    });

    return NextResponse.json({ data: buildCoachDto(updated) });
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
      return NextResponse.json({ error: "Coach introuvable" }, { status: 404 });
    }

    if (isDuplicatePhone) {
      return NextResponse.json({ error: "Un coach avec ce téléphone existe déjà" }, { status: 409 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("coachId" in body)) {
    return NextResponse.json({ error: "coachId requis" }, { status: 400 });
  }

  const coachId = (body as { coachId?: unknown }).coachId;

  if (typeof coachId !== "string" || coachId.trim().length === 0) {
    return NextResponse.json({ error: "coachId invalide" }, { status: 400 });
  }

  const linkedGroups = await prisma.group.findMany({
    where: { tenantId: actor.tenantId, coachId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (linkedGroups.length > 0) {
    return NextResponse.json(
      {
        error: "Ce coach est deja assigne a des groupes",
        details: { groups: linkedGroups },
      },
      { status: 409 },
    );
  }

  try {
    const deactivated = await prisma.coach.update({
      where: { id: coachId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        action: "COACH_DEACTIVATED",
        entityType: "Coach",
        entityId: coachId,
        userId: actor.id,
        details: JSON.stringify({
          name: `${deactivated.firstName} ${deactivated.lastName}`.trim(),
        }),
      },
    });

    return NextResponse.json({ data: deactivated });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Coach introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la desactivation" }, { status: 500 });
  }
}
