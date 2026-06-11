import Link from "next/link";
import { headers } from "next/headers";
import { ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { enrichAuditLogContexts } from "@/lib/audit-log-enricher";
import {
  auditLogMatchesQuery,
  formatAuditDateTime,
  formatAuditUserName,
  presentAuditLog,
} from "@/lib/audit-log-presenter";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  Th,
  Td,
} from "@/components/ui/responsive-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  const role = (await headers()).get("x-user-role");

  if (role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Administration"
          title="Historique des actions"
          description="Seul un administrateur peut consulter le journal."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const allLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const presented = allLogs.map((log) => ({
    log,
    presentation: presentAuditLog(log),
  }));

  const filtered = query
    ? presented.filter(({ log, presentation }) => auditLogMatchesQuery(log, presentation, query))
    : presented;

  const logs = filtered.slice(0, 200).map((p) => p.log);
  const presentationById = await enrichAuditLogContexts(
    logs,
    new Map(filtered.map((p) => [p.log.id, p.presentation])),
  );

  const userIds = Array.from(
    new Set(logs.map((log) => log.userId).filter((id): id is string => !!id)),
  );

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        Retour au tableau de bord
      </Link>

      <PageHeader
        overline="Administration"
        title="Historique des actions"
        description="Qui a fait quoi dans l'application — libellés en français."
      />

      <section className="panel p-4 sm:p-5">
        <form className="page-actions mb-4">
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Rechercher par nom, action, montant…"
            className="field w-full text-sm sm:w-80"
          />
          <button type="submit" className="btn btn-primary btn-block-mobile min-h-11 sm:w-auto">
            Rechercher
          </button>
          {query ? (
            <Link href="/logs" className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
              Effacer
            </Link>
          ) : null}
        </form>

        <DataTable>
          <DataTableHead>
            <tr>
              <Th>Date</Th>
              <Th>Utilisateur</Th>
              <Th>Action</Th>
              <Th className="w-10 text-center">
                <span className="sr-only">Détails</span>
              </Th>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {logs.map((log) => {
              const user = log.userId ? userMap.get(log.userId) : null;
              const presentation = presentationById.get(log.id)!;
              const { date, time } = formatAuditDateTime(log.createdAt);

              return (
                <DataTableRow key={log.id}>
                  <Td label="Date">
                    <span className="font-medium text-[var(--foreground)]">{date}</span>
                    <span className="block text-xs text-[var(--muted-foreground)]">{time}</span>
                  </Td>
                  <Td label="Utilisateur">
                    <span className="font-medium text-[var(--foreground)]">
                      {user ? formatAuditUserName(user.name, user.email) : "Système"}
                    </span>
                  </Td>
                  <Td label="Action">
                    <span className="font-medium text-[var(--foreground)]">{presentation.summary}</span>
                    {presentation.context ? (
                      <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                        {presentation.context}
                      </span>
                    ) : null}
                  </Td>
                  <Td label="Détails" className="text-center">
                    {presentation.hasDetailPage ? (
                      <Link
                        href={`/logs/${log.id}`}
                        className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
                        aria-label={`Voir le détail : ${presentation.summary}`}
                      >
                        <ChevronRight className="size-5" />
                      </Link>
                    ) : (
                      <span className="inline-block size-9" aria-hidden />
                    )}
                  </Td>
                </DataTableRow>
              );
            })}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  Aucune action trouvée.
                </td>
              </tr>
            ) : null}
          </DataTableBody>
        </DataTable>
      </section>
    </main>
  );
}
