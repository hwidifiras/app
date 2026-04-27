import { prisma } from "@/lib/prisma";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <div className="mb-7 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Vue d&apos;ensemble</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Dashboard réception</h1>
        <p className="text-sm text-muted-foreground">
          Pilotage rapide des référentiels et actions quotidiennes du front desk.
        </p>
        {hasSportDataError ? (
          <p className="text-sm font-medium text-amber-600">
            Données sports/coachs temporairement indisponibles. Exécutez `npm run prisma:generate` puis redémarrez le
            serveur.
          </p>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Membres actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--foreground)]">{activeMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Membres archivés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--foreground)]">{archivedMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sports actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--foreground)]">{activeSports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total sports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--foreground)]">{totalSports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Coachs actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--foreground)]">{activeCoaches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total coachs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--foreground)]">{totalCoaches}</p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Membres récents</CardTitle>
            <Link href="/members" className="text-xs font-semibold text-primary underline underline-offset-4">
              Ouvrir gestion membres
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersRows.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.firstName} {member.lastName}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={member.status === "ACTIVE" ? "default" : "outline"}>
                        {member.status === "ACTIVE" ? "ACTIF" : "ARCHIVÉ"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Sports récents</CardTitle>
            <Link href="/sports" className="text-xs font-semibold text-primary underline underline-offset-4">
              Ouvrir gestion sports
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sport</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sportsRows.map((sport) => (
                  <TableRow key={sport.id}>
                    <TableCell>{sport.name}</TableCell>
                    <TableCell className="max-w-[230px] truncate">{sport.description ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={sport.isActive ? "default" : "outline"}>
                        {sport.isActive ? "ACTIF" : "INACTIF"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
