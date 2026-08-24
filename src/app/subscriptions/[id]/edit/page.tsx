import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionEditForm } from "@/components/subscriptions/subscription-edit-form";
import { MemberEnrollmentRecoveryPanel } from "@/components/members/member-enrollment-recovery-panel";
import { sumLedgerRows } from "@/lib/payment-ledger";
import { getAuthUser } from "@/lib/request-user";
import { getEnrollmentRecoveryCandidatesForSubscription } from "@/lib/enrollment-recovery";
import {
  resolveSubscriptionEffectiveState,
  totalPauseSeconds,
} from "@/modules/sales/subscription-lifecycle";
import { hasPermission } from "@/lib/permission-definitions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Ventes"
          title="Corriger l'abonnement"
          description="Connectez-vous pour corriger un abonnement."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const canCorrectSubscriptions =
    authUser.role === "ADMIN" || hasPermission(authUser.permissions, "subscriptions.correct");
  if (!canCorrectSubscriptions) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Ventes"
          title="Corriger l'abonnement"
          description="Votre profil peut vendre et consulter les abonnements, mais pas corriger leur historique."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Droit de correction requis.</p>
          <Link href="/subscriptions" className="btn btn-ghost mt-4">Retour aux abonnements</Link>
        </section>
      </main>
    );
  }

  const [subscription, plans, groups] = await Promise.all([
    prisma.memberSubscription.findFirst({
      where: { id, tenantId: authUser.tenantId },
      include: {
        member: { select: { firstName: true, lastName: true } },
        plan: { select: { name: true } },
        payments: { where: { tenantId: authUser.tenantId }, select: { amount: true } },
        entitlements: {
          include: { sport: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        pauseEvents: { orderBy: { effectiveAt: "asc" } },
        renewedBySubscription: {
          select: { status: true, activationPolicy: true, activatedAt: true, startDate: true },
        },
      },
    }),
    prisma.subscriptionPlan.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        planKind: true,
        entitlements: {
          select: { type: true, sportId: true, sport: { select: { name: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.group.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      select: { id: true, name: true, sportId: true, sport: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!subscription) {
    notFound();
  }

  const plansOptions = plans.some((plan) => plan.id === subscription.planId)
    ? plans
    : [
        ...plans,
        await prisma.subscriptionPlan.findFirstOrThrow({
          where: { id: subscription.planId, tenantId: authUser.tenantId },
          select: {
            id: true,
            name: true,
            price: true,
            planKind: true,
            entitlements: {
              select: { type: true, sportId: true, sport: { select: { name: true } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
      ];
  const enrollmentRecoveryCandidates = await getEnrollmentRecoveryCandidatesForSubscription(
    subscription.id,
    authUser.tenantId,
  );

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/subscriptions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour aux abonnements
      </Link>

      <PageHeader
        overline="Ventes"
        title="Corriger l'abonnement"
        description="Corriger une erreur par une action traçable sans réécrire la vente d'origine."
      />

      <div className="space-y-4">
        <section className="panel p-4 sm:p-6">
          <SubscriptionEditForm
            subscription={{
              id: subscription.id,
              memberName: `${subscription.member.firstName} ${subscription.member.lastName}`,
              planId: subscription.planId,
              planName: subscription.plan.name,
              startDate: subscription.startDate.toISOString(),
              endDate: subscription.endDate?.toISOString() ?? null,
              amount: subscription.amount,
              totalPaid: sumLedgerRows(subscription.payments),
              storedStatus: subscription.status,
              effectiveState: resolveSubscriptionEffectiveState(subscription),
              activationDeadline: subscription.activationDeadline?.toISOString() ?? null,
              freezeAllowanceCount: subscription.freezeAllowanceCount,
              freezeMaxTotalDays: subscription.freezeMaxTotalDays,
              usedPauseCount: subscription.pauseEvents.filter((event) => event.entryType === "PAUSE").length,
              usedPauseDays: Math.floor(totalPauseSeconds(subscription.pauseEvents) / 86_400),
              entitlements: subscription.entitlements.map((right) => ({
                id: right.id,
                type: right.type,
                remainingUnits: right.remainingUnits,
                label: right.type === "GYM_ACCESS"
                  ? "Accès salle"
                  : right.sport?.name ?? "Cours",
              })),
            }}
            plansOptions={plansOptions.map((plan) => ({
              id: plan.id,
              name: plan.name,
              price: plan.price,
              planKind: plan.planKind,
              entitlements: plan.entitlements.map((right) => ({
                type: right.type,
                sportId: right.sportId,
                sportName: right.sport?.name ?? null,
              })),
            }))}
            groupsOptions={groups.map((group) => ({
              id: group.id,
              name: group.name,
              sportId: group.sportId,
              sportName: group.sport.name,
            }))}
          />
        </section>

        <section className="panel border-blue-100 bg-blue-50/35 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
            Annulation inscription
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            Revenir sur l&apos;inscription complète
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Si cet abonnement vient d&apos;une inscription récente encore inutilisée, annulez tout le lot avec motif:
            paiements inversés, reçus annulés, abonnement résilié et affectation fermée.
          </p>
          <MemberEnrollmentRecoveryPanel candidates={enrollmentRecoveryCandidates} />
        </section>
      </div>
    </main>
  );
}
