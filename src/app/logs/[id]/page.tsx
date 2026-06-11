import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { enrichAuditLogPresentation } from "@/lib/audit-log-enricher";
import {
  formatAuditDateTime,
  formatAuditUserName,
  presentAuditLog,
} from "@/lib/audit-log-presenter";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = (await headers()).get("x-user-role");

  if (role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Journal"
          title="Détail de l'action"
          description="Seul un administrateur peut consulter le journal."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const log = await prisma.auditLog.findUnique({ where: { id } });
  if (!log) notFound();

  const presentation = await enrichAuditLogPresentation(log, presentAuditLog(log));

  const user = log.userId
    ? await prisma.user.findUnique({
        where: { id: log.userId },
        select: { name: true, email: true },
      })
    : null;

  const { date, time } = formatAuditDateTime(log.createdAt);

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/logs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-4" />
        Retour au journal
      </Link>

      <PageHeader
        overline="Journal"
        title={presentation.summary}
        description={presentation.context ?? undefined}
      />

      <section className="panel mb-4 p-4 sm:p-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Date
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
              {date}
              <span className="block text-[var(--muted-foreground)]">{time}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Effectué par
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
              {user ? formatAuditUserName(user.name, user.email) : "Système"}
              {user ? (
                <span className="block text-xs font-normal text-[var(--muted-foreground)]">{user.email}</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {presentation.detailSections.length === 0 ? (
        <section className="panel p-4 text-sm text-[var(--muted-foreground)] sm:p-5">
          Aucun détail supplémentaire enregistré pour cette action.
        </section>
      ) : (
        presentation.detailSections.map((section) => (
          <section key={section.title} className="panel mb-4 p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">{section.title}</h2>
            <ul className="divide-y divide-[var(--border)]">
              {section.rows.map((row) => (
                <li key={row.label} className="py-2.5">
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">{row.label}</span>
                  {row.value ? (
                    <p className="mt-0.5 text-sm text-[var(--foreground)]">{row.value}</p>
                  ) : null}
                  {row.list && row.list.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {row.list.map((item, i) => (
                        <li
                          key={`${row.label}-${i}`}
                          className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
