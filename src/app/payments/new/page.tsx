import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentAddForm } from "@/components/payments/payment-add-form";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberSubscriptionId?: string }>;
}) {
  const { memberSubscriptionId } = await searchParams;
  let hasError = false;
  let subscriptions: Array<{
    id: string;
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
        member: { select: { firstName: true, lastName: true } },
        plan: { select: { name: true } },
        payments: { select: { amount: true } },
      },
    });

    subscriptions = rows.map((s) => ({
      id: s.id,
      memberName: `${s.member.firstName} ${s.member.lastName}`,
      planName: s.plan?.name ?? "—",
      amount: s.amount,
      totalPaid: s.payments.reduce((sum, p) => sum + p.amount, 0),
    }));
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Création de paiement indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
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
        overline="Abonnements & Finance"
        title="Nouveau paiement"
        description="Enregistrer un paiement pour un abonnement actif. Le montant ne peut pas dépasser le solde restant dû."
      />

      <section className="panel panel-soft p-6">
        <PaymentAddForm subscriptions={subscriptions} defaultSubscriptionId={memberSubscriptionId} />
      </section>
    </main>
  );
}
