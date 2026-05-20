import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionsListClient } from "@/components/subscriptions/subscriptions-list-client";
import type { SubscriptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubscriptionsPage() {
  let hasError = false;
  let subscriptions: Array<{
    id: string;
    memberName: string;
    memberPhone: string;
    planName: string;
    amount: number;
    startDate: string;
    endDate: string | null;
    status: SubscriptionStatus;
    totalPaid: number;
    remainingSessions: number;
    totalSessions: number;
    createdAt: string;
  }> = [];

  try {
    const rows = await prisma.memberSubscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        member: { select: { firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true, totalSessions: true } },
        payments: { select: { amount: true } },
      },
    });

    subscriptions = rows.map((s) => ({
      id: s.id,
      memberName: `${s.member.firstName} ${s.member.lastName}`,
      memberPhone: s.member.phone,
      planName: s.plan.name,
      amount: s.amount,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString() ?? null,
      status: s.status,
      totalPaid: s.payments.reduce((sum, p) => sum + p.amount, 0),
      remainingSessions: s.remainingSessions,
      totalSessions: s.plan.totalSessions,
      createdAt: s.createdAt.toISOString(),
    }));
  } catch (error) {
    hasError = true;
    console.error("Subscriptions page degraded mode:", error);
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Abonnements indisponibles</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/" className="btn btn-ghost">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Abonnements & Finance"
        title="Abonnements"
        description="Suivi des abonnements membres, statuts et paiements associés."
        actions={
          <Link
            href="/subscriptions/new"
            className="btn btn-primary btn-block-mobile inline-flex items-center justify-center gap-1.5 text-sm"
          >
            <Plus className="size-4" /> Renouvellement
          </Link>
        }
      />

      <section className="panel p-4 sm:p-5">
        <SubscriptionsListClient subscriptions={subscriptions} />
      </section>
    </main>
  );
}
