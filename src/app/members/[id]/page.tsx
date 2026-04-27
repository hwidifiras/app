import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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
    },
  });

  if (!member) {
    notFound();
  }

  const activeGroups = member.groups.filter((g) => g.status === "ACTIVE");
  const inactiveGroups = member.groups.filter((g) => g.status === "INACTIVE");

  return (
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Dossier membre</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">
          {member.firstName} {member.lastName}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Carte identité */}
        <section className="panel panel-soft p-5 md:col-span-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Informations</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Statut</dt>
              <dd>
                <span className={`chip ${member.status === "ACTIVE" ? "chip-active" : "chip-muted"}`}>
                  {member.status === "ACTIVE" ? "ACTIF" : "ARCHIVÉ"}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Téléphone</dt>
              <dd className="font-medium">{member.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Email</dt>
              <dd className="font-medium">{member.email ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Inscription</dt>
              <dd className="font-medium">{new Date(member.joinedAt).toLocaleDateString("fr-FR")}</dd>
            </div>
            {member.archivedAt ? (
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Archivé le</dt>
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
            <p className="mt-3 text-sm text-[var(--muted)]">Aucun groupe actif.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activeGroups.map((gm) => (
                <li key={gm.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{gm.group.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {gm.group.sport?.name ?? "-"} •{" "}
                        {gm.group.coach ? `${gm.group.coach.firstName} ${gm.group.coach.lastName}` : "-"} • Salle{" "}
                        {gm.group.room}
                      </p>
                      {gm.group.schedules[0] ? (
                        <p className="text-xs text-[var(--muted)]">
                          {gm.group.schedules[0].dayOfWeek} {gm.group.schedules[0].startTime} (
                          {gm.group.schedules[0].durationMinutes} min)
                        </p>
                      ) : null}
                    </div>
                    <span className="chip chip-active">ACTIF</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
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
                      <p className="text-xs text-[var(--muted)]">
                        {gm.group.sport?.name ?? "-"} • Salle {gm.group.room}
                      </p>
                    </div>
                    <span className="chip chip-muted">INACTIF</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {new Date(gm.startDate).toLocaleDateString("fr-FR")}
                    {gm.endDate ? ` → ${new Date(gm.endDate).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Sections placeholder pour US-12 et US-13 */}
        <section className="panel p-5 md:col-span-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Historique complet</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Présences, absences et paiements seront disponibles ici après implémentation des US-12 et US-13.
          </p>
        </section>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Link href="/members" className="text-sm font-medium text-[var(--primary)] underline">
          ← Retour à la liste des membres
        </Link>
      </div>
    </main>
  );
}
