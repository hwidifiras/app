import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentEditForm } from "@/components/payments/payment-edit-form";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let hasError = false;
  let payment: Awaited<ReturnType<typeof getPayment>> = null;

  try {
    payment = await getPayment(id);
  } catch {
    hasError = true;
  }

  if (hasError || !payment) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Paiement introuvable</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Le paiement demandé n&apos;existe pas ou les données sont inaccessibles.
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
        title="Modifier un paiement"
        description="Modifier le montant, la date, la méthode ou les notes d’un versement existant."
      />

      <section className="panel panel-soft p-6">
        <PaymentEditForm
          payment={{
            ...payment,
            paymentDate: payment.paymentDate.toISOString(),
          }}
        />
      </section>
    </main>
  );
}

async function getPayment(id: string) {
  return await prisma.payment.findUnique({
    where: { id },
    include: {
      memberSubscription: {
        select: {
          id: true,
          amount: true,
          member: { select: { firstName: true, lastName: true } },
          plan: { select: { name: true } },
          payments: { select: { id: true, amount: true } },
        },
      },
    },
  });
}
