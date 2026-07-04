import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/request-user";
import { updateScheduleTemplateSchema } from "@/lib/schemas/schedule-template";
import { toScheduleTemplateDto } from "@/lib/schedule-template-utils";

export const runtime = "nodejs";

function authFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "FORBIDDEN";
  return NextResponse.json(
    { error: code === "UNAUTHENTICATED" ? "Non authentifie" : "Acces refuse" },
    { status: code === "UNAUTHENTICATED" ? 401 : 403 },
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = updateScheduleTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.scheduleTemplate.findFirst({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Modele introuvable" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.scheduleTemplate.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? "" } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    if (parsed.data.slots) {
      await tx.scheduleTemplateSlot.deleteMany({ where: { templateId: id } });
      await tx.scheduleTemplateSlot.createMany({
        data: parsed.data.slots.map((slot) => ({
          tenantId: admin.tenantId,
          templateId: id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
        })),
      });
    }

    return tx.scheduleTemplate.findUniqueOrThrow({
      where: { id },
      include: { slots: true },
    });
  });

  await prisma.auditLog.create({
    data: {
      action: "SCHEDULE_TEMPLATE_UPDATED",
      entityType: "ScheduleTemplate",
      entityId: id,
      userId: admin.id,
      details: JSON.stringify({ name: updated.name, slots: updated.slots.length, isActive: updated.isActive }),
    },
  });

  return NextResponse.json({ data: toScheduleTemplateDto(updated) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (error) {
    return authFailure(error);
  }

  const { id } = await params;

  const existing = await prisma.scheduleTemplate.findFirst({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Modele introuvable" }, { status: 404 });
  }

  await prisma.scheduleTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      action: "SCHEDULE_TEMPLATE_ARCHIVED",
      entityType: "ScheduleTemplate",
      entityId: id,
      userId: admin.id,
    },
  });

  return NextResponse.json({ data: { archived: true } });
}
