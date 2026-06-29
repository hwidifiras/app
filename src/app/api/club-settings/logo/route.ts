import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { writeClubLogoUrl } from "@/lib/club-settings";
import { requireAdmin } from "@/lib/request-user";

export const runtime = "nodejs";

const MAX_BYTES = 1_048_576;
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const BRANDING_DIR = path.join(process.cwd(), "public", "branding");

async function removeUploadedLogos() {
  try {
    const files = await readdir(BRANDING_DIR);
    await Promise.all(
      files
        .filter((f) => f.startsWith("club-logo."))
        .map((f) => unlink(path.join(BRANDING_DIR, f))),
    );
  } catch {
    /* directory may not exist */
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
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

  await mkdir(BRANDING_DIR, { recursive: true });
  await removeUploadedLogos();

  const filename = `club-logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(BRANDING_DIR, filename), buffer);

  const clubLogoUrl = `/branding/${filename}`;
  try {
    await writeClubLogoUrl(clubLogoUrl);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le logo pour le moment. Contactez le support si le problème continue." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { clubLogoUrl } });
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  await removeUploadedLogos();
  try {
    await writeClubLogoUrl("");
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Impossible de supprimer le logo en base" }, { status: 500 });
  }

  return NextResponse.json({ data: { clubLogoUrl: "" } });
}
