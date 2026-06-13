import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusVariant(status: string) {
  if (status === "NEEDS_FINALIZATION") return "warning";
  if (status === "PLANNED") return "info";
  if (status === "RESCHEDULED") return "warning";
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  return "muted";
}

function attendanceLabel(status: string) {
  if (status === "PRESENT") return "Présent";
  if (status === "ABSENT") return "Absent";
  if (status === "OVERRIDE") return "Exception";
  return status;
}

function attendanceVariant(status: string) {
  if (status === "PRESENT") return "success";
  if (status === "ABSENT") return "danger";
  if (status === "OVERRIDE") return "warning";
  return "muted";
}

export default async function SessionAttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: {
        select: {
          name: true,
          members: {
            include: {
              member: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { member: { lastName: "asc" } },
          },
        },
      },
      coach: { select: { firstName: true, lastName: true } },
      attendances: {
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { checkedAt: "asc" },
      },
    },
  });

  if (!session) notFound();

  const expectedIds = new Set(
    expectedMemberIdsAtSession(session.group.members, session.sessionDate),
  );
  const expectedMembers = session.group.members.filter((member) =>
    expectedIds.has(member.memberId),
  );
  const lifecycle = deriveSessionLifecycle({
    status: session.status,
    sessionDate: session.sessionDate,
    endTime: session.endTime,
    expectedMemberIds: [...expectedIds],
    attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
  });
  const attByMember = new Map(session.attendances.map((a) => [a.memberId, a]));
  const enrolled = expectedMembers.length;
  const present = session.attendances.filter((a) => a.status === "PRESENT").length;
  const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
  const override = session.attendances.filter((a) => a.status === "OVERRIDE").length;
  const checked = present + absent + override;
  const notMarked = Math.max(0, enrolled - checked);

  const dateLabel = session.sessionDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const returnHref = "/attendance/groups";

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href={returnHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        Retour au rapport par groupe
      </Link>

      <PageHeader
        overline="Détail séance"
        title={session.group.name}
        description={`${dateLabel} · ${session.startTime} – ${session.endTime} · ${session.room}`}
        actions={
          lifecycle.operationalStatus === "NEEDS_FINALIZATION" ? (
            <Link href={`/attendance/today?sessionId=${session.id}`} className="btn btn-primary">
              Reprendre le pointage
            </Link>
          ) : undefined
        }
      />

      <section className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-[var(--surface-soft)] p-3">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Inscrits au cours</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{enrolled}</p>
        </div>
        <div className="rounded-xl bg-[var(--success)]/10 p-3">
          <p className="text-xs font-medium text-[var(--success)]">Présents</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--success)]">{present}</p>
        </div>
        <div className="rounded-xl bg-[var(--danger)]/10 p-3">
          <p className="text-xs font-medium text-[var(--danger)]">Absents</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--danger)]">{absent}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-soft)] p-3">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Non pointés</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{notMarked}</p>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            {session.coach
              ? `Coach : ${session.coach.firstName} ${session.coach.lastName}`
              : "Pas de coach assigné"}
            {override > 0 && ` · ${override} passage(s) exceptionnel(s)`}
          </p>
          <StatusBadge
            variant={statusVariant(
              lifecycle.operationalStatus === "NEEDS_FINALIZATION"
                ? "NEEDS_FINALIZATION"
                : session.status,
            )}
          >
            {lifecycle.operationalStatus === "NEEDS_FINALIZATION"
              ? lifecycle.unmarkedCount > 0
                ? `Pointage incomplet (${lifecycle.unmarkedCount})`
                : "À finaliser"
              : session.status}
          </StatusBadge>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Liste du cours</h2>
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {expectedMembers.map((gm) => {
                const att = attByMember.get(gm.memberId);
                return (
                  <li
                    key={gm.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:flex-nowrap"
                  >
                    <Link
                      href={`/members/${gm.member.id}`}
                      className="min-w-0 flex-1 font-medium text-[var(--primary)] hover:underline"
                    >
                      {gm.member.firstName} {gm.member.lastName}
                    </Link>
                    {att ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <StatusBadge variant={attendanceVariant(att.status)}>
                          {attendanceLabel(att.status)}
                        </StatusBadge>
                        {att.checkedBy && <span>par {att.checkedBy}</span>}
                        {att.overrideReason && (
                          <span className="max-w-[12rem] truncate" title={att.overrideReason}>
                            {att.overrideReason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <StatusBadge variant="muted">Non pointé</StatusBadge>
                    )}
                  </li>
                );
              })}
              {enrolled === 0 && (
                <li className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
                  Aucun élève actif dans ce cours.
                </li>
              )}
            </ul>
          </div>

          {session.attendances.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Historique des pointages</h2>
              <div className="data-table overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Élève</th>
                      <th className="px-3 py-2 text-left font-semibold">Statut</th>
                      <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">Heure</th>
                      <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">Par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {session.attendances.map((a) => (
                      <tr key={a.id} className="hover:bg-[var(--surface-soft)]">
                        <td className="data-table-primary px-3 py-2" data-label="Élève">
                          <Link href={`/members/${a.member.id}`} className="text-[var(--primary)] hover:underline">
                            {a.member.firstName} {a.member.lastName}
                          </Link>
                        </td>
                        <td className="px-3 py-2" data-label="Statut">
                          <StatusBadge variant={attendanceVariant(a.status)}>
                            {attendanceLabel(a.status)}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted-foreground)]" data-label="Heure">
                          {a.checkedAt.toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell text-[var(--muted-foreground)]" data-label="Par">
                          {a.checkedBy ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
