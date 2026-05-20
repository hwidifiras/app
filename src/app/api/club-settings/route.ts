import { NextResponse } from "next/server";

import { getClubSettings, writeClubLogoUrl } from "@/lib/club-settings";
import { prisma } from "@/lib/prisma";
import { updateClubSettingsSchema } from "@/lib/schemas/club-settings";
import { requireAdmin, requireAuth } from "@/lib/request-user";

export const runtime = "nodejs";

function serializeSettings(settings: Awaited<ReturnType<typeof getClubSettings>>) {
  return {
    clubName: settings.clubName,
    clubLogoUrl: settings.clubLogoUrl ?? "",
    clubAddress: settings.clubAddress,
    clubPhone: settings.clubPhone,
    allowCheckInWithPartialPayment: settings.allowCheckInWithPartialPayment,
    allowCheckInWithoutSubscription: settings.allowCheckInWithoutSubscription,
    maxStaffDiscountPercent: settings.maxStaffDiscountPercent,
    debtAlertThresholdCents: settings.debtAlertThresholdCents,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const settings = await getClubSettings();
  return NextResponse.json({ data: serializeSettings(settings) });
}

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateClubSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const before = await getClubSettings();

  if (data.clubLogoUrl !== undefined) {
    await writeClubLogoUrl(data.clubLogoUrl);
  }

  const updated = await prisma.clubSettings.update({
    where: { id: "default" },
    data: {
      ...(data.clubName !== undefined ? { clubName: data.clubName } : {}),
      ...(data.clubAddress !== undefined ? { clubAddress: data.clubAddress } : {}),
      ...(data.clubPhone !== undefined ? { clubPhone: data.clubPhone } : {}),
      ...(data.allowCheckInWithPartialPayment !== undefined
        ? { allowCheckInWithPartialPayment: data.allowCheckInWithPartialPayment }
        : {}),
      ...(data.allowCheckInWithoutSubscription !== undefined
        ? { allowCheckInWithoutSubscription: data.allowCheckInWithoutSubscription }
        : {}),
      ...(data.maxStaffDiscountPercent !== undefined
        ? { maxStaffDiscountPercent: data.maxStaffDiscountPercent }
        : {}),
      ...(data.debtAlertThresholdCents !== undefined
        ? { debtAlertThresholdCents: data.debtAlertThresholdCents }
        : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CLUB_SETTINGS_UPDATED",
      entityType: "ClubSettings",
      entityId: updated.id,
      userId: admin.id,
      details: JSON.stringify({
        before: serializeSettings(before),
        after: serializeSettings(updated),
      }),
    },
  });

  const settings = await getClubSettings();
  return NextResponse.json({ data: serializeSettings(settings) });
}
