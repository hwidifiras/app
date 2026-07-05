import Link from "next/link";
import { notFound } from "next/navigation";

import { ReceiptActions } from "@/components/receipts/receipt-actions";
import { ReceiptDocument } from "@/components/receipts/receipt-document";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { parseReceiptSnapshot } from "@/lib/receipts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
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

  return (
    <main className="app-shell py-4 md:py-8 print:bg-white print:p-0">
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
              />
              <Link href="/payments" className="btn btn-ghost btn-block-mobile">
                Historique caisse
              </Link>
            </div>
          }
        />
      </div>

      <ReceiptDocument snapshot={snapshot} status={receipt.status} />
    </main>
  );
}
