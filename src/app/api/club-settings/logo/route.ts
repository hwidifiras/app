import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getClubSettings, writeClubLogoUrl } from "@/lib/club-settings";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_BYTES = 1_048_576;
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const PROFILE_BRANDING = process.env.OFFLINE_DESKTOP === "1" && process.env.GYM_DATA_DIR;
const BRANDING_DIR = PROFILE_BRANDING ? path.join(PROFILE_BRANDING, "branding") : path.join(process.cwd(), "public", "branding");

function tenantLogoKey(tenantSlug: string, tenantId: string) {
  return (tenantSlug || tenantId).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || tenantId;
}

function logoFilePrefix(tenantSlug: string, tenantId: string) {
  return `club-logo-${tenantLogoKey(tenantSlug, tenantId)}`;
}

async function removeUploadedLogos(filePrefix: string) {
  try {
    const files = await readdir(BRANDING_DIR);
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${filePrefix}.`))
        .map((f) => unlink(path.join(BRANDING_DIR, f))),
    );
  } catch {
    /* directory may not exist */
  }
}

async function removeLogoByUrl(logoUrl: string) {
  if (!logoUrl.startsWith("/branding/")) return;
  const filename = path.basename(new URL(logoUrl, "http://localhost").pathname);
  if (!filename.startsWith("club-logo")) return;

  try {
    await unlink(path.join(BRANDING_DIR, filename));
  } catch {
    /* file may already be gone */
  }
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requirePermission(request, "settings.manage");
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide" }, { status: 400 });
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fichier logo requis" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo trop volumineux (max 1 Mo)" }, { status: 400 });
  }

  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Format accepté : PNG, JPEG ou WebP" }, { status: 400 });
  }

  const before = await getClubSettings();
  const filePrefix = logoFilePrefix(admin.tenantSlug, admin.tenantId);

  await mkdir(BRANDING_DIR, { recursive: true });
  if (!PROFILE_BRANDING) await removeUploadedLogos(filePrefix);

  // A new local filename preserves the old logo if the database write fails,
  // avoids stale image caches, and keeps historical receipt images available.
  const filename = PROFILE_BRANDING ? `${filePrefix}-${randomUUID()}.${ext}` : `${filePrefix}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(BRANDING_DIR, filename), buffer);

  const clubLogoUrl = `/branding/${filename}`;
  try {
    await writeClubLogoUrl(clubLogoUrl);
  } catch (e) {
    if (PROFILE_BRANDING) await unlink(path.join(BRANDING_DIR, filename)).catch(() => {});
    console.error(e);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le logo pour le moment. Contactez le support si le problème continue." },
      { status: 500 },
    );
  }

  await prisma.auditLog.create({
    data: {
      tenantId: admin.tenantId,
      action: "CLUB_LOGO_UPDATED",
      entityType: "ClubSettings",
      entityId: before.id,
      userId: admin.id,
      details: JSON.stringify({
        before: { clubLogoUrl: before.clubLogoUrl },
        after: { clubLogoUrl },
        file: { name: file.name, type: file.type, size: file.size },
      }),
    },
  });

  return NextResponse.json({ data: { clubLogoUrl } });
}

export async function DELETE(request: Request) {
  let admin;
  try {
    admin = await requirePermission(request, "settings.manage");
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const before = await getClubSettings();
  const filePrefix = logoFilePrefix(admin.tenantSlug, admin.tenantId);

  if (!PROFILE_BRANDING) { await removeUploadedLogos(filePrefix); await removeLogoByUrl(before.clubLogoUrl); }
  try {
    await writeClubLogoUrl("");
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Impossible de supprimer le logo en base" }, { status: 500 });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: admin.tenantId,
      action: "CLUB_LOGO_REMOVED",
      entityType: "ClubSettings",
      entityId: before.id,
      userId: admin.id,
      details: JSON.stringify({
        before: { clubLogoUrl: before.clubLogoUrl },
        after: { clubLogoUrl: "" },
      }),
    },
  });

  return NextResponse.json({ data: { clubLogoUrl: "" } });
}
