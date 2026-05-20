import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: Date) {
  return value.toLocaleString("fr-FR");
}

function safeJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  const logs = await prisma.auditLog.findMany({
    where: query
      ? {
          OR: [
            { action: { contains: query } },
            { entityType: { contains: query } },
            { entityId: { contains: query } },
            { details: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

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
        Retour au dashboard
      </Link>

      <PageHeader
        overline="Audit"
        title="Journal des actions"
        description="Historique complet des actions dans l'application."
      />

      <section className="panel p-5">
        <form className="mb-4 flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Rechercher par action, entite, id..."
            className="field text-sm w-full sm:w-72"
          />
          <button type="submit" className="btn btn-primary">
            Filtrer
          </button>
          {query ? (
            <Link href="/logs" className="btn btn-ghost">
              Effacer
            </Link>
          ) : null}
        </form>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Utilisateur</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Entite</th>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
                <th className="px-4 py-3 text-left font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {logs.map((log) => {
                const user = log.userId ? userMap.get(log.userId) : null;
                const details = safeJson(log.details);
                const detailText = details ? JSON.stringify(details) : log.details;

                return (
                  <tr key={log.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-4 py-3" data-label="Date">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3" data-label="Utilisateur">
                      {user ? `${user.name} (${user.email})` : "Systeme"}
                    </td>
                    <td className="px-4 py-3 font-medium" data-label="Action">
                      {log.action}
                    </td>
                    <td className="px-4 py-3" data-label="Entite">
                      {log.entityType}
                    </td>
                    <td className="px-4 py-3" data-label="Reference">
                      {log.entityId}
                    </td>
                    <td className="px-4 py-3" data-label="Details">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {detailText ? detailText.slice(0, 140) : "-"}
                        {detailText && detailText.length > 140 ? "..." : ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted-foreground)]">
                    Aucun journal trouve.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
