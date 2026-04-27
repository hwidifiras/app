import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createCoachSchema, updateCoachSchema } from "@/lib/schemas/coach";

export const runtime = "nodejs";

function toCoachDto(coach: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  sportId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sport: { id: string; name: string } | null;
}) {
  return {
    id: coach.id,
    firstName: coach.firstName,
    lastName: coach.lastName,
    phone: coach.phone,
    email: coach.email,
    isActive: coach.isActive,
    sportId: coach.sportId,
    sportName: coach.sport?.name ?? null,
    createdAt: coach.createdAt.toISOString(),
    updatedAt: coach.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const coaches = await prisma.coach.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { phone: { contains: query } },
            { sport: { is: { name: { contains: query } } } },
          ],
        }
      : undefined,
    include: { sport: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: coaches.map(toCoachDto) });
}

export async function POST(request: Request) {
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
  const sportIdValue = parsed.data.sportId && parsed.data.sportId.trim().length > 0 ? parsed.data.sportId : null;

  if (sportIdValue) {
    const sportExists = await prisma.sport.findUnique({ where: { id: sportIdValue }, select: { id: true } });
    if (!sportExists) {
      return NextResponse.json({ error: "Sport de spécialité introuvable" }, { status: 404 });
    }
  }

  try {
    const coach = await prisma.coach.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: emailValue,
        sportId: sportIdValue,
      },
      include: { sport: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: toCoachDto(coach) }, { status: 201 });
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
  const sportIdValue =
    payload.sportId === undefined ? undefined : payload.sportId && payload.sportId.trim().length > 0 ? payload.sportId : null;

  if (sportIdValue) {
    const sportExists = await prisma.sport.findUnique({ where: { id: sportIdValue }, select: { id: true } });
    if (!sportExists) {
      return NextResponse.json({ error: "Sport de spécialité introuvable" }, { status: 404 });
    }
  }

  try {
    const updated = await prisma.coach.update({
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
        sportId: sportIdValue,
        isActive: payload.isActive,
      },
      include: { sport: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: toCoachDto(updated) });
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

  try {
    await prisma.coach.delete({
      where: { id: coachId },
    });

    return NextResponse.json({ data: { id: coachId } });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Coach introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
