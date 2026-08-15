import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, ShieldAlert, Snowflake, UserRoundX } from "lucide-react";

import { GymVisitsList } from "@/components/gym/gym-visits-list";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { getAuthUser } from "@/lib/request-user";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";
import { gymLocalDayRange } from "@/modules/gym/opening-hours";
import { getGymReportSnapshot, parseGymReportRange } from "@/modules/gym/gym-report";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GymVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUser();
  const enabled = user ? await isTenantModuleEnabled(user.tenantId, "GYM_ACCESS") : false;
  const permitted = user ? await userHasPermission(user, "gym.manage") : false;
  if (!user || !enabled || !permitted) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader overline="Accès salle" title="Historique des accès" description="Ce module n'est pas actif ou votre compte n'y a pas accès." />
        <section className="panel panel-soft p-5 text-sm text-[var(--muted-foreground)]">Accès indisponible.</section>
      </main>
    );
  }

  const rawParams = await searchParams;
  const query = new URLSearchParams();
  if (typeof rawParams.from === "string") query.set("from", rawParams.from);
  if (typeof rawParams.to === "string") query.set("to", rawParams.to);
  const range = parseGymReportRange(query);
  const [{ start: todayStart, end: todayEnd }, visits, deniedAttempts, report] = await Promise.all([
    Promise.resolve(gymLocalDayRange(new Date())),
    prisma.gymVisit.findMany({
      where: { tenantId: user.tenantId, checkedAt: { gte: range.from, lt: range.to } },
      include: {
        member: { select: { firstName: true, lastName: true, phone: true } },
        checkedBy: { select: { name: true } },
        memberSubscription: { select: { plan: { select: { name: true } } } },
        corrections: { where: { entryType: "REVERSAL" }, select: { id: true } },
      },
      orderBy: { checkedAt: "desc" },
      take: 500,
    }),
    prisma.gymAccessAttempt.findMany({
      where: { tenantId: user.tenantId, outcome: "DENIED", occurredAt: { gte: range.from, lt: range.to } },
      include: { member: { select: { firstName: true, lastName: true } }, checkedBy: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    getGymReportSnapshot(prisma, { tenantId: user.tenantId, range }),
  ]);
  const admittedToday = visits.filter((visit) =>
    visit.entryType === "CHECK_IN"
    && visit.checkedAt >= todayStart
    && visit.checkedAt < todayEnd
    && visit.corrections.length === 0,
  );
  const rows = visits.map((visit) => ({
    id: visit.id,
    entryType: visit.entryType,
    checkedAt: visit.checkedAt.toISOString(),
    unitsDelta: visit.unitsDelta,
    overrideReason: visit.overrideReason,
    correctionReason: visit.correctionReason,
    memberName: `${visit.member.firstName} ${visit.member.lastName}`,
    memberPhone: visit.member.phone,
    planName: visit.memberSubscription.plan.name,
    checkedByName: visit.checkedBy?.name ?? "Compte désactivé",
    reversed: visit.corrections.length > 0,
  }));
  const toInclusive = new Date(range.to);
  toInclusive.setUTCDate(toInclusive.getUTCDate() - 1);
  const fromValue = range.from.toISOString().slice(0, 10);
  const toValue = toInclusive.toISOString().slice(0, 10);
  const exportQuery = new URLSearchParams({ from: fromValue, to: toValue }).toString();

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/gym/check-in" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"><ArrowLeft className="size-4" /> Retour à l&apos;accès salle</Link>
      <PageHeader
        overline="Accès salle"
        title="Historique et pilotage"
        description="Passages, refus, état des pass et corrections traçables."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/gym/import" className="btn btn-ghost">Vérifier un import</Link>
            <Link href={`/api/gym/visits/export?${exportQuery}`} className="btn btn-ghost"><Download className="size-4" /> Exporter CSV</Link>
          </div>
        }
      />

      <form className="panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-end" method="GET">
        <label className="text-xs font-semibold text-[var(--foreground)]">Du<input name="from" type="date" defaultValue={fromValue} className="field mt-1 block" /></label>
        <label className="text-xs font-semibold text-[var(--foreground)]">Au<input name="to" type="date" defaultValue={toValue} className="field mt-1 block" /></label>
        <button type="submit" className="btn btn-primary">Appliquer</button>
      </form>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4"><CheckCircle2 className="size-5 text-emerald-600" /><p className="mt-3 text-2xl font-bold">{report.visits}</p><p className="text-xs text-[var(--muted-foreground)]">Entrées sur la période · {admittedToday.length} aujourd&apos;hui</p></div>
        <div className="panel p-4"><UserRoundX className="size-5 text-red-600" /><p className="mt-3 text-2xl font-bold">{report.denials}</p><p className="text-xs text-[var(--muted-foreground)]">Accès refusés</p></div>
        <div className="panel p-4"><ShieldAlert className="size-5 text-amber-600" /><p className="mt-3 text-2xl font-bold">{report.overrides}</p><p className="text-xs text-[var(--muted-foreground)]">Passages exceptionnels</p></div>
        <div className="panel p-4"><span className="text-sm font-bold text-[var(--primary)]">TND</span><p className="mt-3 text-2xl font-bold">{formatMoney(report.salesAmount)}</p><p className="text-xs text-[var(--muted-foreground)]">{report.sales} vente(s) · {report.renewals} renouvellement(s)</p></div>
      </section>

      <section className="panel panel-soft mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div><p className="text-xs text-[var(--muted-foreground)]">Pass actifs</p><p className="mt-1 text-lg font-bold">{report.activePasses}</p></div>
        <div><p className="text-xs text-[var(--muted-foreground)]">À activer</p><p className="mt-1 text-lg font-bold">{report.pendingActivationPasses}</p></div>
        <div><p className="text-xs text-[var(--muted-foreground)]">Expirent sous 7 jours</p><p className="mt-1 text-lg font-bold text-amber-700">{report.expiringPasses}</p></div>
        <div><p className="text-xs text-[var(--muted-foreground)]"><Snowflake className="mr-1 inline size-3.5" />En pause</p><p className="mt-1 text-lg font-bold">{report.frozenPasses}</p></div>
        <div><p className="text-xs text-[var(--muted-foreground)]">Avec solde dû</p><p className="mt-1 text-lg font-bold text-red-700">{report.unpaidPasses}</p></div>
      </section>

      <GymVisitsList visits={rows} />

      {deniedAttempts.length > 0 ? (
        <details className="panel mt-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Derniers refus ({report.denials})</summary>
          <div className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {deniedAttempts.map((attempt) => (
              <div key={attempt.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold">{attempt.member ? `${attempt.member.firstName} ${attempt.member.lastName}` : "Carte inconnue"}</p><p className="text-xs text-[var(--muted-foreground)]">{attempt.failureCode ?? "Accès refusé"} · {attempt.checkedBy?.name ?? "Compte désactivé"}</p></div>
                <time className="text-xs text-[var(--muted-foreground)]">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(attempt.occurredAt)}</time>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}
