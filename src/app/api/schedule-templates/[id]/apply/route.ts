import { NextResponse } from "next/server";

import { getClubSettings } from "@/lib/club-settings";
import { CLUB_DAY_LABELS, type ClubDay } from "@/lib/club-working-days";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/request-user";
import { applyScheduleTemplateSchema } from "@/lib/schemas/schedule-template";
import { previousUtcDay, sortTemplateSlots } from "@/lib/schedule-template-utils";

export const runtime = "nodejs";

function authFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "FORBIDDEN";
  return NextResponse.json(
    { error: code === "UNAUTHENTICATED" ? "Non authentifie" : "Acces refuse" },
    { status: code === "UNAUTHENTICATED" ? 401 : 403 },
  );
}

function groupWhereFromTarget(data: {
  targetMode: "SELECTED_GROUPS" | "SPORT" | "GROUP_TYPE" | "ALL_ACTIVE";
  groupIds?: string[];
  sportId?: string;
  groupType?: "KIDS" | "ADULTS";
}) {
  if (data.targetMode === "SELECTED_GROUPS") {
    return { id: { in: data.groupIds ?? [] }, isActive: true };
  }
  if (data.targetMode === "SPORT") {
    return { sportId: data.sportId, isActive: true };
  }
  if (data.targetMode === "GROUP_TYPE") {
    return { groupType: data.groupType, isActive: true };
  }
  return { isActive: true };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (error) {
    return authFailure(error);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = applyScheduleTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.scheduleTemplate.findFirst({
    where: { id, isActive: true },
    include: { slots: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Modele introuvable" }, { status: 404 });
  }

  if (template.slots.length === 0) {
    return NextResponse.json({ error: "Ce modele ne contient aucun horaire" }, { status: 400 });
  }

  const data = parsed.data;
  const effectiveFrom = new Date(data.effectiveFrom);
  const effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
  const closeDate = previousUtcDay(effectiveFrom);
  const groupWhere = groupWhereFromTarget(data);

  const groups = await prisma.group.findMany({
    where: groupWhere,
    select: {
      id: true,
      name: true,
      groupType: true,
      sport: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  if (groups.length === 0) {
    return NextResponse.json({ error: "Aucun groupe actif ne correspond a cette selection" }, { status: 404 });
  }

  const groupIds = groups.map((group) => group.id);
  const [existingSchedulesToClose, futureSessionsCount, settings] = await Promise.all([
    prisma.groupSchedule.count({
      where: {
        groupId: { in: groupIds },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
      },
    }),
    prisma.session.count({
      where: {
        groupId: { in: groupIds },
        sessionDate: { gte: effectiveFrom },
        status: { not: "CANCELLED" },
      },
    }),
    getClubSettings(),
  ]);

  const workingDays = new Set(settings.workingDays);
  const closedDayWarnings = sortTemplateSlots(template.slots)
    .filter((slot) => !workingDays.has(slot.dayOfWeek as ClubDay))
    .map((slot) => `${CLUB_DAY_LABELS[slot.dayOfWeek as ClubDay]} ${slot.startTime}`);

  const summary = {
    templateId: template.id,
    templateName: template.name,
    targetGroups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      sportName: group.sport.name,
      groupType: group.groupType,
    })),
    groupCount: groups.length,
    slotCount: template.slots.length,
    newScheduleCount: groups.length * template.slots.length,
    closedScheduleCount: data.replaceExisting ? existingSchedulesToClose : 0,
    futureSessionsCount,
    closedDayWarnings,
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: effectiveTo?.toISOString() ?? null,
  };

  if (data.dryRun) {
    return NextResponse.json({ data: { applied: false, summary } });
  }

  if (futureSessionsCount > 0 && !data.confirmFutureSessions) {
    return NextResponse.json(
      {
        error: "Des seances futures existent deja pour cette selection. Confirmez avant d'appliquer le modele.",
        data: { applied: false, summary },
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (data.replaceExisting) {
      await tx.groupSchedule.updateMany({
        where: {
          groupId: { in: groupIds },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
        data: { effectiveTo: closeDate },
      });
    }

    await tx.groupSchedule.createMany({
      data: groups.flatMap((group) =>
        sortTemplateSlots(template.slots).map((slot) => ({
          tenantId: admin.tenantId,
          groupId: group.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
          effectiveFrom,
          effectiveTo,
        })),
      ),
      skipDuplicates: true,
    });

    await tx.auditLog.create({
      data: {
        tenantId: admin.tenantId,
        action: "SCHEDULE_TEMPLATE_APPLIED",
        entityType: "ScheduleTemplate",
        entityId: template.id,
        userId: admin.id,
        details: JSON.stringify({
          templateName: template.name,
          groupCount: groups.length,
          slotCount: template.slots.length,
          replaceExisting: data.replaceExisting,
          closedScheduleCount: summary.closedScheduleCount,
          futureSessionsCount,
          effectiveFrom: effectiveFrom.toISOString(),
          effectiveTo: effectiveTo?.toISOString() ?? null,
        }),
      },
    });
  });

  return NextResponse.json({
    data: {
      applied: true,
      summary,
      generation: {
        suggested: true,
        groupIds,
        horizonDays: 90,
      },
    },
  });
}
