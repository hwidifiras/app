"use client";

import Link from "next/link";
import { Mail, Printer } from "lucide-react";
import { useState } from "react";

type ReceiptActionsProps = {
  receiptId: string;
  receiptNumber: string;
  verificationCode: string;
  defaultEmail?: string | null;
};

export function ReceiptActions({
  receiptId,
  receiptNumber,
  verificationCode,
  defaultEmail,
}: ReceiptActionsProps) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const verifyHref = `/receipts/verify?receiptNumber=${encodeURIComponent(receiptNumber)}&code=${encodeURIComponent(verificationCode)}`;
  const hasEmail = Boolean(defaultEmail?.trim());

  async function sendEmail() {
    if (!hasEmail) {
      setMessage({ tone: "error", text: "Aucun email membre disponible." });
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/receipts/${receiptId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: defaultEmail }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage({
          tone: "error",
          text: payload?.error || "Impossible d'envoyer le recu.",
        });
        return;
      }

      setMessage({ tone: "success", text: `Recu envoye a ${payload?.data?.email || defaultEmail}.` });
    } catch {
      setMessage({ tone: "error", text: "Erreur reseau pendant l'envoi du recu." });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={() => window.print()} className="btn btn-primary btn-block-mobile">
          <Printer className="size-4" />
          Imprimer
        </button>
        <button
          type="button"
          onClick={sendEmail}
          disabled={isSending || !hasEmail}
          className="btn btn-ghost btn-block-mobile disabled:cursor-not-allowed disabled:opacity-50"
          title={hasEmail ? `Envoyer a ${defaultEmail}` : "Aucun email membre disponible"}
        >
          <Mail className="size-4" />
          {isSending ? "Envoi..." : "Envoyer email"}
        </button>
        <Link href={verifyHref} className="btn btn-ghost btn-block-mobile">
          Verification publique
        </Link>
      </div>
      {message ? (
        <p
          className={
            message.tone === "success"
              ? "text-xs font-semibold text-emerald-700"
              : "text-xs font-semibold text-red-700"
          }
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
