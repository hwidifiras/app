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

type LogCategory = "BUSINESS" | "ALL" | "PAYMENTS" | "ATTENDANCE" | "ENROLLMENT" | "SETTINGS" | "SYSTEM";

const LOG_CATEGORY_FILTERS: Array<{ id: LogCategory; label: string }> = [
  { id: "BUSINESS", label: "Essentiel" },
  { id: "PAYMENTS", label: "Paiements" },
  { id: "ATTENDANCE", label: "Présences" },
  { id: "ENROLLMENT", label: "Inscriptions" },
  { id: "SETTINGS", label: "Paramètres" },
  { id: "SYSTEM", label: "Système" },
  { id: "ALL", label: "Tout" },
];

function isLogCategory(value: string | undefined): value is LogCategory {
  return Boolean(value && LOG_CATEGORY_FILTERS.some((item) => item.id === value));
}

function isSystemLog(log: { action: string; entityType: string; userId: string | null }) {
  return (
    !log.userId ||
    log.action.startsWith("PASSWORD_RESET") ||
    log.action === "ADMIN_BOOTSTRAPPED" ||
    log.action.startsWith("AUDIT_")
  );
}

function getLogCategory(log: { action: string; entityType: string; userId: string | null }): LogCategory {
  if (isSystemLog(log)) return "SYSTEM";
  if (log.action.startsWith("PAYMENT") || log.entityType === "Payment") return "PAYMENTS";
  if (log.action.startsWith("ATTENDANCE") || log.action.startsWith("SESSION_")) return "ATTENDANCE";
  if (log.action.startsWith("ENROLLMENT") || log.action.startsWith("MEMBER_SUBSCRIPTION")) return "ENROLLMENT";
  if (
    log.action.startsWith("CLUB_SETTINGS") ||
    log.action.startsWith("OFFER_") ||
    log.action.startsWith("USER_") ||
    log.action === "ACCOUNT_UPDATED" ||
    ["ClubSettings", "Offer", "Sport", "Coach", "Group", "SubscriptionPlan", "User"].includes(log.entityType)
  ) {
    return "SETTINGS";
  }
  return "ENROLLMENT";
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}) {
  const { q, page: pageParam, category: categoryParam } = await searchParams;
  const query = q?.trim();
  const selectedCategory = isLogCategory(categoryParam) ? categoryParam : "BUSINESS";
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const pageSize = 30;
  const role = (await headers()).get("x-user-role");

  if (role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Administration"
          title="Journal actions"
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
  });

  const presented = allLogs.map((log) => ({
    log,
    presentation: presentAuditLog(log),
    category: getLogCategory(log),
    isSystem: isSystemLog(log),
  }));

  const categoryFiltered = presented.filter((item) => {
    if (selectedCategory === "ALL") return true;
    if (selectedCategory === "BUSINESS") return !item.isSystem;
    return item.category === selectedCategory;
  });

  const filtered = query
    ? categoryFiltered.filter(({ log, presentation }) => auditLogMatchesQuery(log, presentation, query))
    : categoryFiltered;

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);
  const logs = pageItems.map((p) => p.log);
  const itemById = new Map(pageItems.map((item) => [item.log.id, item]));
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
        title="Journal actions"
        description="Voir qui a fait quoi dans l'application."
      />

      <section className="panel p-4 sm:p-5">
        <form className="page-actions mb-4">
          <input type="hidden" name="category" value={selectedCategory} />
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
            <Link href={logCategoryHref(selectedCategory)} className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
              Effacer
            </Link>
          ) : null}
        </form>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {LOG_CATEGORY_FILTERS.map((item) => {
            const active = item.id === selectedCategory;
            return (
              <Link
                key={item.id}
                href={logCategoryHref(item.id, query)}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold transition ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:border-[var(--primary)]/35"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

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

              const meta = itemById.get(log.id);

              return (
                <DataTableRow key={log.id} className={meta?.isSystem ? "opacity-70" : undefined}>
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
        {pageCount > 1 ? (
          <nav
            aria-label="Pagination"
            className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-center text-xs tabular-nums text-[var(--muted-foreground)] sm:text-left">
              Éléments {startIndex + 1}–{Math.min(startIndex + pageSize, filtered.length)} sur {filtered.length}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Link
                href={logPageHref(currentPage - 1, query, selectedCategory)}
                aria-disabled={currentPage === 1}
                className={`btn btn-ghost min-h-10 px-3 text-xs ${currentPage === 1 ? "pointer-events-none opacity-40" : ""}`}
              >
                Précédent
              </Link>
              <span className="min-w-20 text-center text-xs font-semibold tabular-nums">
                {currentPage} / {pageCount}
              </span>
              <Link
                href={logPageHref(currentPage + 1, query, selectedCategory)}
                aria-disabled={currentPage === pageCount}
                className={`btn btn-ghost min-h-10 px-3 text-xs ${currentPage === pageCount ? "pointer-events-none opacity-40" : ""}`}
              >
                Suivant
              </Link>
            </div>
          </nav>
        ) : null}
      </section>
    </main>
  );
}

function logPageHref(page: number, query?: string, category?: LogCategory) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category && category !== "BUSINESS") params.set("category", category);
  params.set("page", String(Math.max(1, page)));
  return `/logs?${params.toString()}`;
}

function logCategoryHref(category: LogCategory, query?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category !== "BUSINESS") params.set("category", category);
  return `/logs${params.toString() ? `?${params.toString()}` : ""}`;
}
