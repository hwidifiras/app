import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/request-user";
import { createScheduleTemplateSchema } from "@/lib/schemas/schedule-template";
import { toScheduleTemplateDto } from "@/lib/schedule-template-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifie" : "Acces refuse" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const templates = await prisma.scheduleTemplate.findMany({
    where: { isActive: true },
    include: { slots: true },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ data: templates.map(toScheduleTemplateDto) });
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifie" : "Acces refuse" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createScheduleTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await prisma.scheduleTemplate.create({
      data: {
        tenantId: admin.tenantId,
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        slots: {
          create: parsed.data.slots.map((slot) => ({
            tenantId: admin.tenantId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            durationMinutes: slot.durationMinutes,
          })),
        },
      },
      include: { slots: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "SCHEDULE_TEMPLATE_CREATED",
        entityType: "ScheduleTemplate",
        entityId: created.id,
        userId: admin.id,
        details: JSON.stringify({ name: created.name, slots: created.slots.length }),
      },
    });

    return NextResponse.json({ data: toScheduleTemplateDto(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Un modele avec ce nom existe deja" }, { status: 409 });
    }
    throw error;
  }
}
