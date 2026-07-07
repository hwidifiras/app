import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { ReceiptActions } from "@/components/receipts/receipt-actions";
import { ReceiptDocument } from "@/components/receipts/receipt-document";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { buildReceiptVerificationQrDataUrl } from "@/lib/receipt-qr";
import { parseReceiptSnapshot } from "@/lib/receipts";
import { buildReceiptVerificationUrl } from "@/lib/receipt-verification-url";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main data-receipt-print-page className="app-shell py-4 md:py-8 print:bg-white print:p-0">
        <PageHeader
          overline="Caisse"
          title="Reçu indisponible"
          description="Connectez-vous pour consulter ce reçu."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const h = await headers();
  const receipt = await prisma.receipt.findFirst({
    where: { id, tenantId: authUser.tenantId },
    select: {
      id: true,
      receiptNumber: true,
      verificationCode: true,
      status: true,
      snapshotJson: true,
      payment: {
        select: {
          memberSubscription: {
            select: {
              member: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!receipt) notFound();
  const snapshot = parseReceiptSnapshot(receipt);
  if (!snapshot) notFound();
  const host = h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  const verificationUrl = host
    ? buildReceiptVerificationUrl(`${protocol}://${host}`, receipt.receiptNumber, receipt.verificationCode)
    : undefined;
  const verificationQrDataUrl = await buildReceiptVerificationQrDataUrl(verificationUrl);

  return (
    <main data-receipt-print-page className="app-shell py-4 md:py-8 print:bg-white print:p-0">
      <div className="print:hidden">
        <PageHeader
          overline="Caisse"
          title={`Recu ${receipt.receiptNumber}`}
          description="Version imprimable et verification publique du paiement."
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ReceiptActions
                receiptId={receipt.id}
                receiptNumber={receipt.receiptNumber}
                verificationCode={receipt.verificationCode}
                defaultEmail={receipt.payment.memberSubscription.member.email}
                clubName={snapshot.club.name}
              />
              <Link href="/payments" className="btn btn-ghost btn-block-mobile">
                Historique caisse
              </Link>
            </div>
          }
        />
      </div>

      <ReceiptDocument
        snapshot={snapshot}
        status={receipt.status}
        verificationUrl={verificationUrl}
        verificationQrDataUrl={verificationQrDataUrl}
      />
    </main>
  );
}
