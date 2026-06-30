import { NextResponse } from "next/server";

import { getDataImportMode } from "@/lib/data-import-mode";
import { applyBulkDataImport, previewBulkDataImport } from "@/lib/bulk-data-import";
import { requireAdmin } from "@/lib/request-user";
import { withTenantContext } from "@/lib/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bulkImportHeaderLabels: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  memberType: "Type membre",
  groupName: "Groupe",
  planName: "Formule",
};

async function adminOrResponse(request: Request) {
  try {
    return { user: await requireAdmin(request), response: null };
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403;
    return { user: null, response: NextResponse.json({ error: "Acces administrateur requis" }, { status }) };
  }
}

export async function POST(request: Request) {
  const auth = await adminOrResponse(request);
  if (!auth.user) return auth.response;

  return withTenantContext(
    { tenantId: auth.user.tenantId, tenantSlug: auth.user.tenantSlug },
    async () => {
      const mode = await getDataImportMode(auth.user);
      if (!mode.active) {
        return NextResponse.json(
          { error: "Activez d'abord la session temporaire de reprise." },
          { status: 409 },
        );
      }

      const form = await request.formData();
      const action = form.get("action");
      const file = form.get("file");
      const cutoverDate = String(form.get("cutoverDate") ?? new Date().toISOString().slice(0, 10));

      if (action !== "preview" && action !== "apply") {
        return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      }

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Fichier Excel requis" }, { status: 400 });
      }

      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".csv")) {
        return NextResponse.json({ error: "Format accepte: .xlsx ou .csv" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        const data =
          action === "preview"
            ? await previewBulkDataImport(buffer, file.name, cutoverDate)
            : await applyBulkDataImport(buffer, file.name, cutoverDate, auth.user.id);
        return NextResponse.json({ data }, { status: action === "apply" && data.importedRows > 0 ? 201 : 200 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "BULK_IMPORT_FAILED";
        if (message.startsWith("BULK_IMPORT_MISSING_HEADERS:")) {
          const labels = message
            .replace("BULK_IMPORT_MISSING_HEADERS:", "")
            .split(",")
            .map((header) => bulkImportHeaderLabels[header] ?? header)
            .join(", ");
          return NextResponse.json(
            { error: `Colonnes manquantes: ${labels}` },
            { status: 400 },
          );
        }
        if (message === "BULK_IMPORT_EMPTY_WORKBOOK") {
          return NextResponse.json({ error: "Le fichier ne contient aucune feuille exploitable." }, { status: 400 });
        }
        console.error("[POST /api/data-import/bulk]", error);
        return NextResponse.json({ error: "Import Excel impossible" }, { status: 500 });
      }
    },
  );
}
