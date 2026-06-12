import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/status-badge";
import { MemberProfileHero } from "@/components/members/member-profile-hero";
import { MemberSubscriptionCards } from "@/components/members/member-subscription-cards";
import { formatGroupRoomLabel } from "@/lib/group-room";
import { MemberEditCard } from "@/components/members/member-edit-card";
import { MemberDangerActions } from "@/components/members/member-danger-actions";
import { MemberOffersSection } from "@/components/members/member-offers-section";
import { HouseholdCard } from "@/components/members/household-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarCheck2, UsersRound } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-FR");
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

  const activeGroups = member.groups.filter((g) => g.status === "ACTIVE");
  const inactiveGroups = member.groups.filter((g) => g.status === "INACTIVE");
  const activeSubsBySport = member.subscriptions.filter((s) => s.status === "ACTIVE");
  const totalDebt = member.subscriptions.reduce((sum, sub) => {
    const totalPaid = sub.payments.reduce((acc, payment) => acc + payment.amount, 0);
    return sum + Math.max(0, sub.amount - totalPaid);
  }, 0);

  const subscriptionCards = member.subscriptions.map((sub) => ({
    id: sub.id,
    planName: sub.plan.name,
    sportName: sub.sport.name,
    status: sub.status,
    startDate: sub.startDate,
    endDate: sub.endDate,
    amount: sub.amount,
    paidCents: sub.payments.reduce((sum, payment) => sum + payment.amount, 0),
    remainingSessions: sub.remainingSessions,
    totalSessions: sub.plan.totalSessions,
  }));

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
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
          activeSubscriptionsCount={activeSubsBySport.length}
          activeGroupsCount={activeGroups.length}
        />

        <div className="grid min-w-0 items-start gap-4 sm:gap-5 lg:grid-cols-12">
          <div className="contents">
            <section className="panel order-2 min-w-0 p-4 sm:p-5 lg:col-span-8 lg:row-start-1">
              <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Groupes actifs ({activeGroups.length})
                </h2>
                {member.status === "ACTIVE" && (
                  <Link
                    href={`/members/${member.id}/add-to-group`}
                    className="btn btn-primary btn-block-mobile btn-sm sm:w-auto"
                  >
                    + Ajouter au groupe
                  </Link>
                )}
              </div>
              {activeGroups.length === 0 ? (
                <EmptyState
                  icon={<UsersRound className="size-8 opacity-45" />}
                  title="Aucun groupe actif"
                  message="Affectez ce membre à un groupe pour planifier ses séances."
                  action={
                    member.status === "ACTIVE" ? (
                      <Link href={`/members/${member.id}/add-to-group`} className="btn btn-primary">
                        Ajouter au groupe
                      </Link>
                    ) : undefined
                  }
                  className="py-8"
                />
              ) : (
                <ul className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
                  {activeGroups.map((gm) => (
                    <li key={gm.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/35 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{gm.group.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {gm.group.sport?.name ?? "-"} ·{" "}
                            {gm.group.coach ? `${gm.group.coach.firstName} ${gm.group.coach.lastName}` : "Sans coach"}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Salle {formatGroupRoomLabel(gm.group.room)}
                            {gm.group.schedules[0]
                              ? ` · ${gm.group.schedules[0].dayOfWeek} ${gm.group.schedules[0].startTime}`
                              : ""}
                          </p>
                        </div>
                        <StatusBadge variant="success">Actif</StatusBadge>
                      </div>
                      <p className="mt-2 text-[0.7rem] text-[var(--muted-foreground)]">
                        Depuis le {new Date(gm.startDate).toLocaleDateString("fr-FR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel order-3 min-w-0 p-4 sm:p-5 lg:col-span-8 lg:row-start-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Abonnements ({member.subscriptions.length})
              </h2>
              <div className="mt-3">
                <MemberSubscriptionCards subscriptions={subscriptionCards} />
              </div>
            </section>

            <section className="panel order-6 min-w-0 p-4 sm:p-5 lg:col-span-8 lg:row-start-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Présences récentes ({member.attendances.length})
          </h2>
          {member.attendances.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck2 className="size-8 opacity-45" />}
              title="Aucun pointage"
              message="Les présences et absences apparaîtront ici après le premier pointage."
              className="mt-3 py-8"
            />
          ) : (
            <div className="mt-3 data-table overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Groupe</th>
                    <th className="px-3 py-2 text-left font-semibold">Statut</th>
                    <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">Pointage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {member.attendances.map((a) => (
                    <tr key={a.id} className="hover:bg-[var(--surface-soft)]">
                      <td className="data-table-primary px-3 py-2" data-label="Date">
                        {formatDate(a.session.sessionDate)} {a.session.startTime}
                      </td>
                      <td className="px-3 py-2" data-label="Groupe">{a.session.group?.name ?? "—"}</td>
                      <td className="px-3 py-2" data-label="Statut">
                        <StatusBadge
                          variant={
                            a.status === "PRESENT"
                              ? "success"
                              : a.status === "ABSENT"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {a.status === "PRESENT" ? "Présent" : a.status === "ABSENT" ? "Absent" : "Exception"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted-foreground)] text-xs" data-label="Pointage">
                        {formatDate(a.checkedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </section>

            {inactiveGroups.length > 0 ? (
              <details className="panel order-7 min-w-0 p-4 sm:p-5 lg:col-span-12 lg:row-start-5">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
                  Anciennes affectations ({inactiveGroups.length})
                </summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {inactiveGroups.map((gm) => (
                    <li key={gm.id} className="rounded-xl border border-[var(--border)] p-3 opacity-75">
                      <p className="text-sm font-medium">{gm.group.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {gm.group.sport?.name ?? "-"} · Salle {formatGroupRoomLabel(gm.group.room)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDate(gm.startDate)}
                        {gm.endDate ? ` → ${formatDate(gm.endDate)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <aside className="contents">
            <div className="order-1 min-w-0 lg:col-span-4 lg:row-start-1">
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
            </div>
            <div className="order-4 min-w-0 lg:col-span-4 lg:row-start-2">
              <HouseholdCard memberId={member.id} />
            </div>
            <div className="order-5 min-w-0 lg:col-span-12 lg:row-start-4">
              <MemberOffersSection
                memberId={member.id}
                memberName={`${member.firstName} ${member.lastName}`}
                wide
              />
            </div>
            <div className="order-8 min-w-0 lg:col-span-4 lg:row-start-3">
              <MemberDangerActions
                memberId={member.id}
                memberName={`${member.firstName} ${member.lastName}`}
                status={member.status}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
