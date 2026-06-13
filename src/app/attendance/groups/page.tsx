import Link from "next/link";
import { CalendarSearch, ChevronRight, RotateCcw } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: Date) {
  return value.toLocaleDateString("fr-FR");
}

function formatDateInput(value: Date) {
  return value.toISOString().split("T")[0] ?? "";
}

function statusVariant(status: string) {
  if (status === "PLANNED") return "info";
  if (status === "RESCHEDULED") return "warning";
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  return "muted";
}

function sessionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PLANNED: "Planifiée",
    RESCHEDULED: "Reportée",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
  };
  return labels[status] ?? status;
}

export default async function AttendanceByGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; from?: string; to?: string; page?: string }>;
}) {
  const { groupId, from, to, page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const pageSize = 50;

  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 14);

  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : defaultTo;
  toDate.setHours(23, 59, 59, 999);

  const groups = await prisma.group.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const memberCounts = await prisma.groupMember.groupBy({
    by: ["groupId"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  const enrolledByGroup = new Map(memberCounts.map((r) => [r.groupId, r._count._all]));

  const sessions = await prisma.session.findMany({
    where: {
      ...(groupId ? { groupId } : {}),
      sessionDate: { gte: fromDate, lte: toDate },
    },
    include: {
      group: { select: { id: true, name: true } },
      coach: { select: { firstName: true, lastName: true } },
      attendances: { select: { status: true } },
    },
    orderBy: [{ group: { name: "asc" } }, { sessionDate: "desc" }, { startTime: "asc" }],
  });
  const pageCount = Math.max(1, Math.ceil(sessions.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedSessions = sessions.slice(startIndex, startIndex + pageSize);

  const grouped = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      rows: Array<{
        id: string;
        date: Date;
        startTime: string;
        endTime: string;
        status: string;
        coachName: string;
        present: number;
        absent: number;
        override: number;
        checked: number;
        enrolled: number;
        notMarked: number;
      }>;
    }
  >();

  for (const session of pagedSessions) {
    const present = session.attendances.filter((a) => a.status === "PRESENT").length;
    const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
    const override = session.attendances.filter((a) => a.status === "OVERRIDE").length;
    const checked = present + absent + override;
    const enrolled = enrolledByGroup.get(session.groupId) ?? 0;
    const notMarked = Math.max(0, enrolled - checked);
    const coachName = session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : "—";

    if (!grouped.has(session.groupId)) {
      grouped.set(session.groupId, {
        groupId: session.groupId,
        groupName: session.group.name,
        rows: [],
      });
    }

    grouped.get(session.groupId)?.rows.push({
      id: session.id,
      date: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      coachName,
      present,
      absent,
      override,
      checked,
      enrolled,
      notMarked,
    });
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/attendance"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        Retour aux présences
      </Link>

      <PageHeader
        overline="Suivi"
        title="Présences par groupe"
        description="Rapport par séance : pointages, effectif du cours et détail par élève."
      />

      <section className="panel p-3 sm:p-5">
        <form className="sticky top-[57px] z-20 -mx-2 mb-4 grid gap-3 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur sm:grid-cols-2 lg:top-[3.5rem] lg:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.55fr)_minmax(10rem,0.55fr)_auto]">
          <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Groupe
            <select name="groupId" defaultValue={groupId ?? ""} className="field text-sm">
              <option value="">Tous les groupes</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Du
            <input name="from" type="date" defaultValue={formatDateInput(fromDate)} className="field text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Au
            <input name="to" type="date" defaultValue={formatDateInput(toDate)} className="field text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2 self-end sm:col-span-2 lg:col-span-1">
            <Link
              href="/attendance/groups"
              className="btn btn-ghost min-h-11"
              title="Réinitialiser les filtres"
            >
              <RotateCcw className="size-4" />
              <span className="lg:sr-only">Réinitialiser</span>
            </Link>
            <button type="submit" className="btn btn-primary min-h-11">
              Filtrer
            </button>
          </div>
        </form>

        {grouped.size === 0 ? (
          <EmptyState
            icon={<CalendarSearch className="size-8 opacity-45" />}
            title="Aucune séance trouvée"
            message="Élargissez la période ou choisissez un autre groupe."
            action={
              <Link href="/attendance/groups" className="btn btn-ghost">
                Réinitialiser les filtres
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.values()).map((group) => (
              <details
                key={group.groupId}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                open
              >
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                  <span>{group.groupName}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">{group.rows.length} séance(s)</span>
                </summary>
                <div className="data-table overflow-x-auto border-t border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                        <th className="px-4 py-3 text-left font-semibold">Horaire</th>
                        <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Coach</th>
                        <th className="px-4 py-3 text-center font-semibold">Prés.</th>
                        <th className="px-4 py-3 text-center font-semibold">Abs.</th>
                        <th className="px-4 py-3 text-center font-semibold hidden sm:table-cell">Exc.</th>
                        <th className="px-4 py-3 text-center font-semibold">Pointés</th>
                        <th className="px-4 py-3 text-center font-semibold hidden md:table-cell">Inscrits</th>
                        <th className="px-4 py-3 text-right font-semibold">Statut</th>
                        <th className="px-4 py-3 text-right font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {group.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                          <td className="data-table-primary px-4 py-3 whitespace-nowrap" data-label="Date">
                            {formatDate(row.date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" data-label="Horaire">
                            {row.startTime} – {row.endTime}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell" data-label="Coach">
                            {row.coachName}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-[var(--success)]" data-label="Présents">
                            {row.present}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-[var(--danger)]" data-label="Absents">
                            {row.absent}
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell" data-label="Exceptions">
                            {row.override}
                          </td>
                          <td className="px-4 py-3 text-center" data-label="Pointés">
                            {row.checked}
                            {row.notMarked > 0 && (
                              <span className="block text-[0.65rem] text-[var(--muted-foreground)]">
                                {row.notMarked} non pointé{row.notMarked > 1 ? "s" : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell text-[var(--muted-foreground)]" data-label="Inscrits">
                            {row.enrolled}
                          </td>
                          <td className="px-4 py-3 text-right" data-label="Statut">
                            <StatusBadge variant={statusVariant(row.status)}>
                              {sessionStatusLabel(row.status)}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/attendance/sessions/${row.id}`}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                            >
                              Détail
                              <ChevronRight className="size-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
            {pageCount > 1 ? (
              <nav
                aria-label="Pagination"
                className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-center text-xs tabular-nums text-[var(--muted-foreground)] sm:text-left">
                  Séances {startIndex + 1}–{Math.min(startIndex + pageSize, sessions.length)} sur {sessions.length}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Link
                    href={attendanceReportPageHref(currentPage - 1, { groupId, from, to })}
                    aria-disabled={currentPage === 1}
                    className={`btn btn-ghost min-h-10 px-3 text-xs ${currentPage === 1 ? "pointer-events-none opacity-40" : ""}`}
                  >
                    Précédent
                  </Link>
                  <span className="min-w-20 text-center text-xs font-semibold tabular-nums">
                    {currentPage} / {pageCount}
                  </span>
                  <Link
                    href={attendanceReportPageHref(currentPage + 1, { groupId, from, to })}
                    aria-disabled={currentPage === pageCount}
                    className={`btn btn-ghost min-h-10 px-3 text-xs ${currentPage === pageCount ? "pointer-events-none opacity-40" : ""}`}
                  >
                    Suivant
                  </Link>
                </div>
              </nav>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

function attendanceReportPageHref(
  page: number,
  filters: { groupId?: string; from?: string; to?: string },
) {
  const params = new URLSearchParams();
  if (filters.groupId) params.set("groupId", filters.groupId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(Math.max(1, page)));
  return `/attendance/groups?${params.toString()}`;
}
