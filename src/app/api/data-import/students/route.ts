import { NextResponse } from "next/server";
import { requirePermission, jsonAuthFailureResponse } from "@/lib/permissions";
import { getDataImportMode } from "@/lib/data-import-mode";
import { withTenantContext } from "@/lib/tenant-context";
import { applyStudentImport, previewStudentImport, studentImportCatalog, studentImportOptions } from "@/lib/student-excel-import";
import { studentExcelTemplate } from "@/lib/student-excel-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function administrator(request: Request) {
  const user = await requirePermission(request, "settings.manage");
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
export async function GET(request: Request) {
  let user;
  try { user = await administrator(request); } catch (error) { return jsonAuthFailureResponse(error); }
  return withTenantContext({ tenantId: user.tenantId, tenantSlug: user.tenantSlug }, async () => {
    try {
      const url = new URL(request.url);
      if (url.searchParams.get("template") === "1") {
        const options = studentImportOptions.parse(JSON.parse(url.searchParams.get("options") ?? "{}"));
        const buffer = await studentExcelTemplate(user.tenantId, options);
        return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="we-discipline-import-${options.kind.toLowerCase()}.xlsx"` } });
      }
      const catalog = await studentImportCatalog(user.tenantId);
      const mode = await getDataImportMode(user);
      return NextResponse.json({ data: { plans: catalog.plans, groups: catalog.groups, modules: catalog.modules, importActive: mode.active } });
    } catch { return NextResponse.json({ error: "Impossible de préparer le modèle ou le catalogue." }, { status: 400 }); }
  });
}
export async function POST(request: Request) {
  let user;
  try { user = await administrator(request); } catch (error) { return jsonAuthFailureResponse(error); }
  return withTenantContext({ tenantId: user.tenantId, tenantSlug: user.tenantSlug }, async () => {
    if (!(await getDataImportMode(user)).active) return NextResponse.json({ error: "Activez la session temporaire de reprise." }, { status: 409 });
    try {
      if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
      const form = await request.formData(), file = form.get("file"), action = form.get("action");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size === 0) return NextResponse.json({ error: "Fichier requis, maximum 5 Mo." }, { status: 400 });
      if (action !== "preview" && action !== "apply") return NextResponse.json({ error: "Action invalide." }, { status: 400 });
      const options = studentImportOptions.parse(JSON.parse(String(form.get("options") ?? "{}")));
      const input = { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, options, tenantId: user.tenantId, actorId: user.id };
      const data = action === "preview" ? await previewStudentImport(input) : await applyStudentImport({ ...input, previewToken: String(form.get("previewToken") ?? "") });
      return NextResponse.json({ data }, { status: action === "apply" ? 201 : 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import impossible.";
      // Never return database diagnostics or student payloads.
      const publicError = /^(P\d{4}|Invalid `|\n|Prisma)/.test(message) || message.length > 500 ? "Import interrompu. Aucun élève ajouté. Vérifiez à nouveau le fichier." : message;
      return NextResponse.json({ error: publicError }, { status: 409 });
    }
  });
}
