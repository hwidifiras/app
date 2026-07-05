import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { enrichAuditLogPresentation } from "@/lib/audit-log-enricher";
import { policyForAuditAction } from "@/lib/recovery-policy";
import { getAuthUser } from "@/lib/request-user";
import {
  formatAuditDateTime,
  formatAuditUserName,
  presentAuditLog,
} from "@/lib/audit-log-presenter";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BEHAVIOR_LABELS: Record<string, string> = {
  edit: "Correction simple",
  correct: "Correction tracée",
  reverse: "Annulation / contre-écriture",
  void: "Annulation sans suppression",
  archive: "Archivage",
  close: "Clôture",
  "draft-delete": "Suppression de brouillon",
};

function entityHref(entityType: string, entityId: string) {
  if (!entityId) return null;
  if (entityType === "Member") return `/members/${entityId}`;
  if (entityType === "Payment") return `/payments/${entityId}/edit`;
  if (entityType === "MemberSubscription") return `/subscriptions/${entityId}/edit`;
  if (entityType === "Group") return `/groups/${entityId}/edit`;
  if (entityType === "Session") return `/attendance/sessions/${entityId}`;
  if (entityType === "SubscriptionPlan") return `/subscription-plans/${entityId}/edit`;
  if (entityType === "Receipt") return `/receipts/${entityId}`;
  if (entityType === "ClubSettings") return "/settings/club";
  if (entityType === "User") return "/settings/users";
  if (entityType === "DataImport") return "/settings/data-import";
  return null;
}

export default async function LogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser || authUser.role !== "ADMIN") {
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

  const log = await prisma.auditLog.findFirst({
    where: { id, tenantId: authUser.tenantId },
  });
  if (!log) notFound();

  const presentation = await enrichAuditLogPresentation(log, presentAuditLog(log), authUser.tenantId);

  const user = log.userId
    ? await prisma.user.findFirst({
        where: { id: log.userId, tenantId: authUser.tenantId },
        select: { name: true, email: true },
      })
    : null;

  const { date, time } = formatAuditDateTime(log.createdAt);
  const policy = policyForAuditAction(log.action);
  const relatedHref = entityHref(log.entityType, log.entityId);

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

      <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="panel p-4 sm:p-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Résumé</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Date</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                {date}
                <span className="block text-[var(--muted-foreground)]">{time}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Effectué par</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                {user ? formatAuditUserName(user.name, user.email) : "Système"}
                {user ? (
                  <span className="block text-xs font-normal text-[var(--muted-foreground)]">{user.email}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Objet</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                {relatedHref ? (
                  <Link href={relatedHref} prefetch={false} className="inline-flex items-center gap-1.5 text-[var(--primary)] hover:underline">
                    Ouvrir l&apos;objet lié <ExternalLink className="size-3.5" />
                  </Link>
                ) : (
                  log.entityType
                )}
                <span className="mt-0.5 block break-all text-xs font-normal text-[var(--muted-foreground)]">
                  {log.entityType} · {log.entityId}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Action technique</dt>
              <dd className="mt-0.5 break-all text-sm font-medium text-[var(--foreground)]">{log.action}</dd>
            </div>
          </dl>
        </div>

        <div className="panel panel-soft p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-[var(--primary)]">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Traçabilité</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Ce bloc explique comment l&apos;action se corrige sans effacer l&apos;historique.
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Mode</dt>
              <dd className="mt-0.5 font-semibold text-[var(--foreground)]">
                {policy ? BEHAVIOR_LABELS[policy.behavior] : "Journal informatif"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Motif</dt>
              <dd className="mt-0.5 text-[var(--foreground)]">
                {policy?.reasonRequired ? "Motif requis pour la correction" : "Motif non requis par cette règle"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Règle</dt>
              <dd className="mt-0.5 text-[var(--foreground)]">
                {policy?.normalUserCopy ?? "Action conservée pour audit"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Historique</dt>
              <dd className="mt-0.5 text-[var(--foreground)]">
                {policy?.preservesHistory ?? true ? "Conservé dans le journal" : "Action de brouillon sans historique métier"}
              </dd>
            </div>
          </dl>
        </div>
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
