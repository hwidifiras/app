"use client";

import Link from "next/link";
import { Printer } from "lucide-react";

export function ReceiptActions({ receiptNumber, verificationCode }: { receiptNumber: string; verificationCode: string }) {
  const verifyHref = `/receipts/verify?receiptNumber=${encodeURIComponent(receiptNumber)}&code=${encodeURIComponent(verificationCode)}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center print:hidden">
      <button type="button" onClick={() => window.print()} className="btn btn-primary btn-block-mobile">
        <Printer className="size-4" />
        Imprimer
      </button>
      <Link href={verifyHref} className="btn btn-ghost btn-block-mobile">
        Verification publique
      </Link>
    </div>
  );
}
