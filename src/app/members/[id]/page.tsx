import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

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
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Carte identité */}
        <section className="panel panel-soft p-5 md:col-span-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Informations</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted-foreground)]">Statut</dt>
              <dd>
                <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                  {member.status === "ACTIVE" ? "Actif" : "Archivé"}
                </StatusBadge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted-foreground)]">Téléphone</dt>
              <dd className="font-medium">{member.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted-foreground)]">Email</dt>
              <dd className="font-medium">{member.email ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted-foreground)]">Inscription</dt>
              <dd className="font-medium">{new Date(member.joinedAt).toLocaleDateString("fr-FR")}</dd>
            </div>
            {member.archivedAt ? (
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Archivé le</dt>
                <dd className="font-medium text-[var(--danger)]">
                  {new Date(member.archivedAt).toLocaleDateString("fr-FR")}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Groupes actifs */}
        <section className="panel p-5 md:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Groupes actifs ({activeGroups.length})
          </h2>
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

        {/* Présences récentes */}
        <section className="panel p-5 md:col-span-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Présences récentes ({member.attendances.length})
          </h2>
          {member.attendances.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aucune présence enregistrée.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
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
                      <td className="px-3 py-2">
                        {formatDate(a.session.sessionDate)} {a.session.startTime}
                      </td>
                      <td className="px-3 py-2">{a.session.group?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          variant={
                            a.status === "PRESENT"
                              ? "success"
                              : a.status === "ABSENT"
                                ? "danger"
                                : a.status === "EXCUSED"
                                  ? "info"
                                  : "warning"
                          }
                        >
                          {a.status === "PRESENT" ? "Présent" : a.status === "ABSENT" ? "Absent" : a.status === "EXCUSED" ? "Excusé" : "Exception"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted-foreground)] text-xs">
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
