import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, Clock3, CreditCard, UsersRound } from "lucide-react";

import { MemberDangerActions } from "@/components/members/member-danger-actions";
import { MemberEditCard } from "@/components/members/member-edit-card";
import { MemberOffersSection } from "@/components/members/member-offers-section";
import { MemberProfileHero } from "@/components/members/member-profile-hero";
import { MemberSubscriptionCards } from "@/components/members/member-subscription-cards";
import { HouseholdCard } from "@/components/members/household-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  Td,
  Th,
} from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGroupRoomLabel } from "@/lib/group-room";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-FR");
}

function attendanceStatus(status: string) {
  if (status === "PRESENT") return { label: "Présent", variant: "success" as const };
  if (status === "ABSENT") return { label: "Absent", variant: "danger" as const };
  return { label: "Exception", variant: "warning" as const };
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      groups: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
              sport: { select: { name: true } },
              coach: { select: { firstName: true, lastName: true } },
              room: true,
              schedules: { orderBy: { createdAt: "asc" }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          sport: { select: { id: true, name: true } },
          plan: { select: { name: true, price: true, totalSessions: true } },
          payments: { select: { amount: true, paymentDate: true }, orderBy: { paymentDate: "desc" }, take: 10 },
        },
      },
      attendances: {
        orderBy: { checkedAt: "desc" },
        take: 20,
        include: {
          session: {
            select: {
              sessionDate: true,
              startTime: true,
              group: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!member) {
    notFound();
  }

  const activeGroups = member.groups.filter((assignment) => assignment.status === "ACTIVE");
  const inactiveGroups = member.groups.filter((assignment) => assignment.status === "INACTIVE");
  const activeSubscriptions = member.subscriptions.filter((subscription) => subscription.status === "ACTIVE");
  const totalDebt = member.subscriptions.reduce((sum, subscription) => {
    const totalPaid = subscription.payments.reduce((acc, payment) => acc + payment.amount, 0);
    return sum + Math.max(0, subscription.amount - totalPaid);
  }, 0);

  const subscriptionCards = member.subscriptions.map((subscription) => ({
    id: subscription.id,
    planName: subscription.plan.name,
    sportName: subscription.sport.name,
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    amount: subscription.amount,
    paidCents: subscription.payments.reduce((sum, payment) => sum + payment.amount, 0),
    remainingSessions: subscription.remainingSessions,
    totalSessions: subscription.plan.totalSessions,
  }));

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour aux membres
      </Link>

      <div className="grid min-w-0 gap-4 sm:gap-5">
        <MemberProfileHero
          member={{
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
            email: member.email,
            memberType: member.memberType,
            status: member.status,
            joinedAt: member.joinedAt,
            parentName: member.parentName,
            parentPhone: member.parentPhone,
          }}
          totalDebtCents={totalDebt}
          activeSubscriptionsCount={activeSubscriptions.length}
          activeGroupsCount={activeGroups.length}
        />

        <div className="grid min-w-0 items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 gap-4 sm:gap-5">
            <section className="panel min-w-0 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                    Cours
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Actifs ({activeGroups.length})
                  </h2>
                </div>
                {member.status === "ACTIVE" ? (
                  <Link href={`/members/${member.id}/add-to-group`} className="btn btn-primary btn-block-mobile btn-sm sm:w-auto">
                    + Affecter
                  </Link>
                ) : null}
              </div>

              {activeGroups.length === 0 ? (
                <EmptyState
                  icon={<UsersRound className="size-8 opacity-45" />}
                  title="Aucun cours actif"
                  message="Affectez ce membre à un cours pour le retrouver dans le pointage."
                  action={
                    member.status === "ACTIVE" ? (
                      <Link href={`/members/${member.id}/add-to-group`} className="btn btn-primary">
                        Affecter
                      </Link>
                    ) : undefined
                  }
                  className="py-8"
                />
              ) : (
                <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
                  {activeGroups.map((assignment) => {
                    const schedule = assignment.group.schedules[0];
                    const coach = assignment.group.coach
                      ? `${assignment.group.coach.firstName} ${assignment.group.coach.lastName}`
                      : "Sans coach";

                    return (
                      <li key={assignment.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                              {assignment.group.name}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {assignment.group.sport?.name ?? "-"} · {coach}
                            </p>
                          </div>
                          <StatusBadge variant="success">Actif</StatusBadge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
                          <span>Salle {formatGroupRoomLabel(assignment.group.room)}</span>
                          <span>{schedule ? `${schedule.dayOfWeek} ${schedule.startTime}` : "Créneau à planifier"}</span>
                          <span className="sm:col-span-2">Depuis le {formatDate(assignment.startDate)}</span>
                        </div>
                        <div className="mt-3">
                          <Link href={`/sessions?groupId=${assignment.group.id}`} className="btn btn-ghost btn-sm w-full">
                            Voir planning
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="panel min-w-0 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                    Abonnements
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Formules ({member.subscriptions.length})
                  </h2>
                </div>
                <CreditCard className="size-5 text-[var(--muted-foreground)]" />
              </div>
              <MemberSubscriptionCards subscriptions={subscriptionCards} />
            </section>

            <section className="panel min-w-0 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                    Présences
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Récentes ({member.attendances.length})
                  </h2>
                </div>
                <CalendarCheck2 className="size-5 text-[var(--muted-foreground)]" />
              </div>

              {member.attendances.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck2 className="size-8 opacity-45" />}
                  title="Aucun pointage"
                  message="Les présences et absences apparaîtront ici après le premier pointage."
                  className="py-8"
                />
              ) : (
                <DataTable>
                  <DataTableHead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Cours</Th>
                      <Th>Statut</Th>
                      <Th className="hidden sm:table-cell">Pointage</Th>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {member.attendances.map((attendance) => {
                      const status = attendanceStatus(attendance.status);
                      return (
                        <DataTableRow key={attendance.id}>
                          <Td label="Date" primary>
                            {formatDate(attendance.session.sessionDate)} {attendance.session.startTime}
                          </Td>
                          <Td label="Cours">{attendance.session.group?.name ?? "-"}</Td>
                          <Td label="Statut">
                            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                          </Td>
                          <Td label="Pointage" className="hidden text-xs text-[var(--muted-foreground)] sm:table-cell">
                            {formatDate(attendance.checkedAt)}
                          </Td>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              )}
            </section>

            <MemberOffersSection memberId={member.id} memberName={`${member.firstName} ${member.lastName}`} wide />

            {inactiveGroups.length > 0 ? (
              <details className="panel min-w-0 p-4 sm:p-5">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
                  Anciennes affectations ({inactiveGroups.length})
                </summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {inactiveGroups.map((assignment) => (
                    <li key={assignment.id} className="rounded-lg border border-[var(--border)] p-3 opacity-75">
                      <p className="text-sm font-medium">{assignment.group.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {assignment.group.sport?.name ?? "-"} · Salle {formatGroupRoomLabel(assignment.group.room)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDate(assignment.startDate)}
                        {assignment.endDate ? ` → ${formatDate(assignment.endDate)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <aside className="grid min-w-0 gap-4 sm:gap-5">
            <MemberEditCard
              member={{
                id: member.id,
                firstName: member.firstName,
                lastName: member.lastName,
                phone: member.phone,
                email: member.email,
                memberType: member.memberType,
                birthDate: member.birthDate?.toISOString() ?? null,
                address: member.address,
                parentName: member.parentName,
                parentPhone: member.parentPhone,
                parentAddress: member.parentAddress,
                status: member.status,
                joinedAt: member.joinedAt.toISOString(),
                archivedAt: member.archivedAt?.toISOString() ?? null,
              }}
            />
            <HouseholdCard memberId={member.id} />
            <div className="panel panel-soft p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <Clock3 className="size-4 text-[var(--primary)]" />
                Prochain réflexe
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Vérifiez le solde, puis affectez le membre au bon cours avant le prochain pointage.
              </p>
            </div>
            <MemberDangerActions
              memberId={member.id}
              memberName={`${member.firstName} ${member.lastName}`}
              status={member.status}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
