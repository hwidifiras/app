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

  const [subscription, plans] = await Promise.all([
    prisma.memberSubscription.findFirst({
      where: { id, tenantId: authUser.tenantId },
      include: {
        member: { select: { firstName: true, lastName: true } },
        payments: { where: { tenantId: authUser.tenantId }, select: { amount: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, totalSessions: true, validityDays: true },
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
          select: { id: true, name: true, price: true, totalSessions: true, validityDays: true },
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
        description="Ajuster dates, formule, séances ou statut avec motif quand une valeur sensible change."
      />

      <div className="space-y-4">
        <section className="panel p-4 sm:p-6">
          <SubscriptionEditForm
            subscription={{
              id: subscription.id,
              memberName: `${subscription.member.firstName} ${subscription.member.lastName}`,
              planId: subscription.planId,
              startDate: subscription.startDate.toISOString(),
              endDate: subscription.endDate?.toISOString() ?? null,
              amount: subscription.amount,
              totalPaid: sumLedgerRows(subscription.payments),
              remainingSessions: subscription.remainingSessions,
              status: subscription.status,
            }}
            plansOptions={plansOptions}
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
