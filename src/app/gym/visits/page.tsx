import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldAlert, Users } from "lucide-react";

import { GymVisitsList } from "@/components/gym/gym-visits-list";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { getAuthUser } from "@/lib/request-user";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GymVisitsPage() {
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

  const visits = await prisma.gymVisit.findMany({
    where: { tenantId: user.tenantId },
    include: {
      member: { select: { firstName: true, lastName: true, phone: true } },
      checkedBy: { select: { name: true } },
      memberSubscription: { select: { plan: { select: { name: true } } } },
      corrections: { where: { entryType: "REVERSAL" }, select: { id: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const admittedToday = visits.filter((visit) => visit.entryType === "CHECK_IN" && visit.checkedAt >= today && visit.corrections.length === 0);
  const exceptionalToday = admittedToday.filter((visit) => Boolean(visit.overrideReason));
  const uniqueMembersToday = new Set(admittedToday.map((visit) => visit.memberId)).size;
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

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/gym/check-in" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"><ArrowLeft className="size-4" /> Retour à l&apos;accès salle</Link>
      <PageHeader overline="Accès salle" title="Historique des accès" description="Passages enregistrés et corrections traçables." />
      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><CheckCircle2 className="size-5 text-emerald-600" /><p className="mt-3 text-2xl font-bold">{admittedToday.length}</p><p className="text-xs text-[var(--muted-foreground)]">Entrées aujourd&apos;hui</p></div>
        <div className="panel p-4"><Users className="size-5 text-[var(--primary)]" /><p className="mt-3 text-2xl font-bold">{uniqueMembersToday}</p><p className="text-xs text-[var(--muted-foreground)]">Membres distincts</p></div>
        <div className="panel p-4"><ShieldAlert className="size-5 text-amber-600" /><p className="mt-3 text-2xl font-bold">{exceptionalToday.length}</p><p className="text-xs text-[var(--muted-foreground)]">Passages exceptionnels</p></div>
      </section>
      <GymVisitsList visits={rows} />
    </main>
  );
}
