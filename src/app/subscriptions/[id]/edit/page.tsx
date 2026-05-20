import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionEditForm } from "@/components/subscriptions/subscription-edit-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [subscription, plans] = await Promise.all([
    prisma.memberSubscription.findUnique({
      where: { id },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
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
        await prisma.subscriptionPlan.findUniqueOrThrow({
          where: { id: subscription.planId },
          select: { id: true, name: true, price: true, totalSessions: true, validityDays: true },
        }),
      ];

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/subscriptions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour aux abonnements
      </Link>

      <PageHeader
        overline="Abonnements & Finance"
        title="Modifier l'abonnement"
        description="Ajustez le plan, les dates, les séances restantes ou résiliez proprement l'abonnement."
      />

      <section className="panel panel-soft p-6">
        <SubscriptionEditForm
          subscription={{
            id: subscription.id,
            memberName: `${subscription.member.firstName} ${subscription.member.lastName}`,
            planId: subscription.planId,
            startDate: subscription.startDate.toISOString(),
            endDate: subscription.endDate?.toISOString() ?? null,
            amount: subscription.amount,
            remainingSessions: subscription.remainingSessions,
            status: subscription.status,
          }}
          plansOptions={plansOptions}
        />
      </section>
    </main>
  );
}
