import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Dumbbell, User, Archive, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: "ACTIVE" | "ARCHIVED";
};

type DashboardSport = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type KpiCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
};

function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-[0.78rem] font-medium text-[var(--muted-foreground)]">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function Home() {
  let hasSportDataError = false;
  let activeMembers = 0;
  let archivedMembers = 0;
  let activeSports = 0;
  let totalSports = 0;
  let activeCoaches = 0;
  let totalCoaches = 0;
  let membersRows: DashboardMember[] = [];
  let sportsRows: DashboardSport[] = [];

  try {
    const [
      fetchedActiveMembers,
      fetchedArchivedMembers,
      fetchedActiveSports,
      fetchedTotalSports,
      fetchedActiveCoaches,
      fetchedTotalCoaches,
      fetchedRecentMembers,
      fetchedRecentSports,
    ] = await Promise.all([
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.member.count({ where: { status: "ARCHIVED" } }),
      prisma.sport.count({ where: { isActive: true } }),
      prisma.sport.count(),
      prisma.coach.count({ where: { isActive: true } }),
      prisma.coach.count(),
      prisma.member.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.sport.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    activeMembers = fetchedActiveMembers;
    archivedMembers = fetchedArchivedMembers;
    activeSports = fetchedActiveSports;
    totalSports = fetchedTotalSports;
    activeCoaches = fetchedActiveCoaches;
    totalCoaches = fetchedTotalCoaches;
    membersRows = fetchedRecentMembers;
    sportsRows = fetchedRecentSports;
  } catch (error) {
    hasSportDataError = true;
    console.error("Dashboard degraded mode due to Prisma model mismatch:", error);

    const [fetchedActiveMembers, fetchedArchivedMembers, fetchedRecentMembers] = await Promise.all([
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.member.count({ where: { status: "ARCHIVED" } }),
      prisma.member.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    activeMembers = fetchedActiveMembers;
    archivedMembers = fetchedArchivedMembers;
    membersRows = fetchedRecentMembers;
  }

  return (
    <main className="app-shell py-6 md:py-8">
      <PageHeader
        overline="Vue d'ensemble"
        title="Dashboard réception"
        description="Pilotage rapide des référentiels et actions quotidiennes du front desk."
      />

      {hasSportDataError ? (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          Données sports/coachs temporairement indisponibles. Exécutez <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs">npm run prisma:generate</code> puis redémarrez.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Membres actifs" value={activeMembers} icon={<Users className="size-5 text-white" />} color="bg-[var(--primary)]" />
        <KpiCard label="Membres archivés" value={archivedMembers} icon={<Archive className="size-5 text-white" />} color="bg-slate-500" />
        <KpiCard label="Sports actifs" value={activeSports} icon={<Dumbbell className="size-5 text-white" />} color="bg-emerald-600" />
        <KpiCard label="Total sports" value={totalSports} icon={<Dumbbell className="size-5 text-white" />} color="bg-emerald-400" />
        <KpiCard label="Coachs actifs" value={activeCoaches} icon={<User className="size-5 text-white" />} color="bg-violet-600" />
        <KpiCard label="Total coachs" value={totalCoaches} icon={<User className="size-5 text-white" />} color="bg-violet-400" />
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base font-semibold">Membres récents</CardTitle>
            <Link href="/members" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
              Voir tout <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-t border-b border-[var(--border)] bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-semibold">Nom</th>
                    <th className="px-5 py-2.5 text-left font-semibold">Téléphone</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {membersRows.map((member) => (
                    <tr key={member.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                      <td className="px-5 py-2.5 font-medium">{member.firstName} {member.lastName}</td>
                      <td className="px-5 py-2.5 text-[var(--muted-foreground)]">{member.phone}</td>
                      <td className="px-5 py-2.5 text-right">
                        <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                          {member.status === "ACTIVE" ? "Actif" : "Archivé"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {membersRows.length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-6 text-center text-[var(--muted-foreground)]">Aucun membre.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base font-semibold">Sports récents</CardTitle>
            <Link href="/sports" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
              Voir tout <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-t border-b border-[var(--border)] bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-semibold">Sport</th>
                    <th className="px-5 py-2.5 text-left font-semibold">Description</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sportsRows.map((sport) => (
                    <tr key={sport.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                      <td className="px-5 py-2.5 font-medium">{sport.name}</td>
                      <td className="max-w-[200px] truncate px-5 py-2.5 text-[var(--muted-foreground)]">{sport.description ?? "—"}</td>
                      <td className="px-5 py-2.5 text-right">
                        <StatusBadge variant={sport.isActive ? "success" : "muted"}>
                          {sport.isActive ? "Actif" : "Inactif"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {sportsRows.length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-6 text-center text-[var(--muted-foreground)]">Aucun sport.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
