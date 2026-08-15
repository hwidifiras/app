import { NextResponse } from "next/server";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";
import { previewGymImport } from "@/modules/gym/gym-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headerLabels: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  phone: "Téléphone",
  planName: "Formule",
};

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "gym.manage");
    await requireTenantModule(actor.tenantId, "GYM_ACCESS");
  } catch (error) {
    if (error instanceof Error && error.message === "MODULE_DISABLED") {
      const failure = tenantModuleErrorResponse(error);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    return jsonAuthFailureResponse(error);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (5 Mo maximum)" }, { status: 413 });
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".csv")) {
    return NextResponse.json({ error: "Formats acceptés : .xlsx ou .csv" }, { status: 400 });
  }

  try {
    const data = await previewGymImport({
      tenantId: actor.tenantId,
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const code = error instanceof Error ? error.message : "GYM_IMPORT_FAILED";
    if (code === "GYM_IMPORT_EMPTY") return NextResponse.json({ error: "Le fichier ne contient aucune ligne exploitable" }, { status: 400 });
    if (code.startsWith("GYM_IMPORT_MISSING_HEADERS:")) {
      const labels = code.replace("GYM_IMPORT_MISSING_HEADERS:", "").split(",").map((key) => headerLabels[key] ?? key);
      return NextResponse.json({ error: `Colonnes manquantes : ${labels.join(", ")}` }, { status: 400 });
    }
    console.error("[POST /api/gym/import]", error);
    return NextResponse.json({ error: "Analyse du fichier impossible" }, { status: 500 });
  }
}
