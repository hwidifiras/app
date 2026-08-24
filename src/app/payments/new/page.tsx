import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentAddForm } from "@/components/payments/payment-add-form";
import { getClubSettings } from "@/lib/club-settings";
import { paymentReturnLabel, resolvePaymentReturnPath } from "@/lib/payment-navigation";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberSubscriptionId?: string; memberId?: string; returnTo?: string }>;
}) {
  const { memberSubscriptionId, memberId, returnTo } = await searchParams;
  const returnPath = resolvePaymentReturnPath(returnTo);
  const returnLabel = paymentReturnLabel(returnPath);
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Ventes"
          title="Encaisser"
          description="Connectez-vous pour enregistrer un paiement."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  let hasError = false;
  let subscriptions: Array<{
    id: string;
    memberId: string;
    memberName: string;
    planName: string;
    amount: number;
    totalPaid: number;
  }> = [];
  let receiptPrintDefault = true;

  try {
    const settings = await getClubSettings();
    receiptPrintDefault = settings.receiptPrintDefault;
    const rows = await prisma.memberSubscription.findMany({
      where: {
        tenantId: authUser.tenantId,
        status: "ACTIVE",
        ...(memberId ? { memberId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { name: true } },
        payments: { where: { tenantId: authUser.tenantId }, select: { amount: true } },
      },
    });

    subscriptions = rows
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
            <Link href={returnPath} className="btn btn-ghost">Retour vers {returnLabel}</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href={returnPath}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)]/8 hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour vers {returnLabel}
      </Link>

      <PageHeader
        overline="Ventes"
        title="Encaisser"
        description="Choisir le membre, vérifier l'abonnement et confirmer le montant reçu."
      />

      <PaymentAddForm
        subscriptions={payableSubscriptions}
        receiptPrintDefault={receiptPrintDefault}
        returnPath={returnPath}
        returnLabel={returnLabel}
        defaultSubscriptionId={
          payableSubscriptions.some((subscription) => subscription.id === defaultSubscriptionId)
            ? defaultSubscriptionId
            : payableSubscriptions[0]?.id
        }
      />
    </main>
  );
}
