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
    take: 50,
  });

  return NextResponse.json({ data: members });
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

  try {
    const member = await prisma.member.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: emailValue,
      },
    });

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    const isDuplicatePhone =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

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
