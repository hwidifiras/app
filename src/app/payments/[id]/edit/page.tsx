import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentEditForm } from "@/components/payments/payment-edit-form";
import { buildReceiptDeliveryStatus, RECEIPT_EMAIL_AUDIT_ACTIONS } from "@/lib/receipt-delivery-status";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Ventes"
          title="Correction paiement"
          description="Connectez-vous pour corriger un paiement."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  let hasError = false;
  let payment: Awaited<ReturnType<typeof getPayment>> = null;
  let receiptDeliveryLogs: Awaited<ReturnType<typeof getReceiptDeliveryLogs>> = [];

  try {
    payment = await getPayment(id, authUser.tenantId);
    if (payment?.receipt) {
      receiptDeliveryLogs = await getReceiptDeliveryLogs(payment.receipt.id, authUser.tenantId);
    }
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
        overline="Ventes"
        title="Correction paiement"
        description="Créer une correction tracée avec le motif et le nouveau montant."
      />

      <PaymentEditForm
        payment={{
          ...payment,
          paymentDate: payment.paymentDate.toISOString(),
        }}
        receiptDeliveryLogs={receiptDeliveryLogs}
      />
    </main>
  );
}

async function getPayment(id: string, tenantId: string) {
  return await prisma.payment.findFirst({
    where: { id, tenantId },
    include: {
      memberSubscription: {
        select: {
          id: true,
          amount: true,
          member: { select: { firstName: true, lastName: true, email: true } },
          plan: { select: { name: true } },
          payments: { select: { id: true, amount: true, correctsPaymentId: true } },
        },
      },
      receipt: {
        select: {
          id: true,
          receiptNumber: true,
          verificationCode: true,
          status: true,
        },
      },
    },
  });
}

async function getReceiptDeliveryLogs(receiptId: string, tenantId: string) {
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entityType: "Receipt",
      entityId: receiptId,
      action: { in: [...RECEIPT_EMAIL_AUDIT_ACTIONS] },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const userIds = [...new Set(logs.map((log) => log.userId).filter((userId): userId is string => Boolean(userId)))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  return logs.map((log) => {
    const deliveryStatus = buildReceiptDeliveryStatus(log);
    const actor = log.userId ? usersById.get(log.userId) : null;
    return {
      id: log.id,
      action: log.action,
      ...deliveryStatus,
      actorName: actor?.name || actor?.email || null,
    };
  });
}
