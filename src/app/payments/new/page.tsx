import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentAddForm } from "@/components/payments/payment-add-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberSubscriptionId?: string; memberId?: string }>;
}) {
  const { memberSubscriptionId, memberId } = await searchParams;
  let hasError = false;
  let subscriptions: Array<{
    id: string;
    memberId: string;
    memberName: string;
    planName: string;
    amount: number;
    totalPaid: number;
  }> = [];

  try {
    const rows = await prisma.memberSubscription.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { name: true } },
        payments: { select: { amount: true } },
      },
    });

    subscriptions = rows
      .filter((s) => !memberId || s.member.id === memberId)
      .map((s) => ({
        id: s.id,
        memberId: s.member.id,
        memberName: `${s.member.firstName} ${s.member.lastName}`,
        planName: s.plan?.name ?? "—",
        amount: s.amount,
        totalPaid: s.payments.reduce((sum, p) => sum + p.amount, 0),
      }));
  } catch {
    hasError = true;
  }

  const defaultSubscriptionId =
    memberSubscriptionId ??
    subscriptions.find((s) => s.amount > s.totalPaid)?.id ??
    subscriptions[0]?.id;

  const payableSubscriptions = subscriptions.filter((subscription) => subscription.amount > subscription.totalPaid);

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Création de paiement indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Les abonnements ne sont pas accessibles pour le moment. Réessayez dans quelques instants.
          </p>
          <div className="mt-4">
            <Link href="/payments" className="btn btn-ghost">Retour aux paiements</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/payments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Finance"
        title="Encaisser"
        description="Choisir le membre, vérifier l'abonnement et confirmer le montant reçu."
      />

      <section className="panel p-3.5 sm:p-5">
        <PaymentAddForm
          subscriptions={payableSubscriptions}
          defaultSubscriptionId={
            payableSubscriptions.some((subscription) => subscription.id === defaultSubscriptionId)
              ? defaultSubscriptionId
              : payableSubscriptions[0]?.id
          }
        />
      </section>
    </main>
  );
}
