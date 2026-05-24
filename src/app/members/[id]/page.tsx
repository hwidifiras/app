import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MemberDangerActions } from "@/components/members/member-danger-actions";
import { MemberEditCard } from "@/components/members/member-edit-card";
import { HouseholdCard } from "@/components/members/household-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

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
  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Dossier membre"
        title={`${member.firstName} ${member.lastName}`}
        description={
          totalDebt > 0
            ? `Dette en cours: ${formatCurrency(totalDebt)}`
            : "Aucune dette en cours"
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Carte identité */}
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

        {activeSubsBySport.length > 0 && (
          <section className="panel p-5 md:col-span-3">
            <h2 className="text-lg font-semibold">Abonnements actifs par discipline</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {activeSubsBySport.map((sub) => {
                const paid = sub.payments.reduce((s, p) => s + p.amount, 0);
                return (
                  <div key={sub.id} className="rounded-lg border p-3">
                    <p className="font-medium">{sub.sport.name}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">{sub.plan.name}</p>
                    <p className="text-sm">
                      {formatCurrency(paid)} / {formatCurrency(sub.amount)} — {sub.remainingSessions} séances
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Groupes actifs */}
        <section className="panel p-5 md:col-span-2">
          <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Groupes actifs ({activeGroups.length})
            </h2>
            {member.status === "ACTIVE" && (
              <Link
                href={`/members/${member.id}/add-to-group`}
                className="btn btn-primary btn-block-mobile text-xs sm:w-auto"
              >
                + Ajouter
              </Link>
            )}
          </div>
          {activeGroups.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aucun groupe actif.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activeGroups.map((gm) => (
                <li key={gm.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{gm.group.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {gm.group.sport?.name ?? "-"} •{" "}
                        {gm.group.coach ? `${gm.group.coach.firstName} ${gm.group.coach.lastName}` : "-"} • Salle{" "}
                        {gm.group.room}
                      </p>
                      {gm.group.schedules[0] ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {gm.group.schedules[0].dayOfWeek} {gm.group.schedules[0].startTime} (
                          {gm.group.schedules[0].durationMinutes} min)
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge variant="success">Actif</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Depuis le {new Date(gm.startDate).toLocaleDateString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Historique groupes */}
        {inactiveGroups.length > 0 ? (
          <section className="panel p-5 md:col-span-3">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Historique des affectations ({inactiveGroups.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {inactiveGroups.map((gm) => (
                <li key={gm.id} className="rounded-lg border border-[var(--border)] p-3 opacity-70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{gm.group.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {gm.group.sport?.name ?? "-"} • Salle {gm.group.room}
                      </p>
                    </div>
                    <StatusBadge variant="muted">Inactif</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {new Date(gm.startDate).toLocaleDateString("fr-FR")}
                    {gm.endDate ? ` → ${new Date(gm.endDate).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Abonnements */}
        <section className="panel p-5 md:col-span-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Abonnements ({member.subscriptions.length})
          </h2>
          {member.subscriptions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aucun abonnement enregistré.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {member.subscriptions.map((sub) => {
                const totalPaid = sub.payments.reduce((sum, p) => sum + p.amount, 0);
                return (
                  <li key={sub.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{sub.plan.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {formatDate(sub.startDate)}
                          {sub.endDate ? ` → ${formatDate(sub.endDate)}` : ""} —{" "}
                          <span className={totalPaid >= sub.amount ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                            Payé {formatCurrency(totalPaid)} / {formatCurrency(sub.amount)}
                          </span>
                          {sub.status === "ACTIVE" && sub.plan && (
                            <span className={sub.remainingSessions > 0 ? "text-[var(--info)] ml-1" : "text-[var(--danger)] ml-1"}>
                              ({sub.remainingSessions} / {sub.plan.totalSessions} séances restantes)
                            </span>
                          )}
                        </p>
                      </div>
                      <StatusBadge
                        variant={
                          sub.status === "ACTIVE"
                            ? "success"
                            : sub.status === "DRAFT"
                              ? "info"
                              : sub.status === "EXPIRED"
                                ? "warning"
                                : "danger"
                        }
                      >
                        {sub.status === "ACTIVE" ? "Actif" : sub.status === "DRAFT" ? "Brouillon" : sub.status === "EXPIRED" ? "Expiré" : "Annulé"}
                      </StatusBadge>
                    </div>
                    {sub.payments.length > 0 && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Dernier paiement: {formatCurrency(sub.payments[0].amount)} le {formatDate(sub.payments[0].paymentDate)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <MemberDangerActions
          memberId={member.id}
          memberName={`${member.firstName} ${member.lastName}`}
          status={member.status}
        />

        {/* Présences récentes */}
        <section className="panel p-5 md:col-span-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Présences récentes ({member.attendances.length})
          </h2>
          {member.attendances.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aucune présence enregistrée.</p>
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
      </div>
    </main>
  );
}
