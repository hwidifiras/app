import { headers } from "next/headers";

import { ReceiptDocument } from "@/components/receipts/receipt-document";
import { unscopedPrisma } from "@/lib/prisma";
import { buildReceiptVerificationQrDataUrl } from "@/lib/receipt-qr";
import { parseReceiptSnapshot } from "@/lib/receipts";
import { buildReceiptVerificationUrl } from "@/lib/receipt-verification-url";
import { resolveTenantFromHost } from "@/lib/tenant-resolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReceiptVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ receiptNumber?: string; code?: string }>;
}) {
  const params = await searchParams;
  const h = await headers();
  const receiptNumber = params.receiptNumber?.trim().toUpperCase() ?? "";
  const code = params.code?.trim().toUpperCase() ?? "";
  const canSearch = receiptNumber.length > 0 && code.length > 0;
  const host = h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  const resolvedTenant = await resolveTenantFromHost(h.get("x-forwarded-host") ?? host);
  const verificationUrl =
    canSearch && host ? buildReceiptVerificationUrl(`${protocol}://${host}`, receiptNumber, code) : undefined;

  const receipt =
    canSearch && resolvedTenant.ok
      ? await unscopedPrisma.receipt.findFirst({
          where: {
            tenantId: resolvedTenant.context.tenantId,
            receiptNumber,
            verificationCode: code,
          },
          select: {
            status: true,
            snapshotJson: true,
          },
        })
      : null;

  const snapshot = receipt ? parseReceiptSnapshot(receipt) : null;
  const verificationQrDataUrl = snapshot
    ? await buildReceiptVerificationQrDataUrl(verificationUrl)
    : undefined;

  return (
    <main data-receipt-print-page className="min-h-screen bg-[#F6F9FF] px-4 py-8 text-[#0B1220] print:min-h-0 print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto max-w-3xl print:max-w-none">
        <section className="mb-5 rounded-lg border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-panel)] print:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2563EB]">Verification recu</p>
          <h1 className="mt-2 text-2xl font-black tracking-normal">Verifier un recu We Discipline</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Saisissez le numero de recu et le code de verification presentes sur le document imprime ou envoye.
          </p>

          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" action="/receipts/verify">
            <label className="text-sm font-semibold">
              Numero de recu
              <input name="receiptNumber" defaultValue={receiptNumber} placeholder="WD-2026-000001" className="field mt-1" />
            </label>
            <label className="text-sm font-semibold">
              Code
              <input name="code" defaultValue={code} placeholder="A1B2C3D4E5" className="field mt-1 uppercase" />
            </label>
            <button type="submit" className="btn btn-primary mt-0 sm:mt-6">
              Verifier
            </button>
          </form>
        </section>

        {canSearch && !snapshot ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Aucun recu valide ne correspond a ce numero et ce code pour ce club.
          </div>
        ) : null}

        {snapshot && receipt ? (
          <ReceiptDocument
            snapshot={snapshot}
            status={receipt.status}
            publicMode
            verificationUrl={verificationUrl}
            verificationQrDataUrl={verificationQrDataUrl}
          />
        ) : null}
      </div>
    </main>
  );
}
