import { NextResponse } from "next/server";

import { getAppTimeZone } from "@/lib/dates";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";
import { parseGymReportRange } from "@/modules/gym/gym-report";

export const runtime = "nodejs";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
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

  const range = parseGymReportRange(new URL(request.url).searchParams);
  const visits = await prisma.gymVisit.findMany({
    where: { tenantId: actor.tenantId, checkedAt: { gte: range.from, lt: range.to } },
    include: {
      member: { select: { firstName: true, lastName: true, phone: true } },
      checkedBy: { select: { name: true } },
      memberSubscription: { select: { plan: { select: { name: true } } } },
      corrections: { where: { entryType: "REVERSAL" }, select: { id: true } },
    },
    orderBy: { checkedAt: "asc" },
  });
  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: getAppTimeZone(),
  });
  const headers = ["Date", "Membre", "Téléphone", "Formule", "État", "Variation quota", "Agent", "Motif", "ID passage"];
  const rows = visits.map((visit) => {
    const state = visit.entryType === "REVERSAL"
      ? "Correction"
      : visit.corrections.length > 0
        ? "Annulé"
        : visit.overrideReason
          ? "Exceptionnel"
          : "Admis";
    return [
      dateFormatter.format(visit.checkedAt),
      `${visit.member.firstName} ${visit.member.lastName}`,
      visit.member.phone,
      visit.memberSubscription.plan.name,
      state,
      visit.unitsDelta,
      visit.checkedBy?.name ?? "Compte désactivé",
      visit.overrideReason ?? visit.correctionReason ?? "",
      visit.id,
    ];
  });
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="acces-salle-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
