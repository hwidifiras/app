"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Mail, MessageCircle, ReceiptText } from "lucide-react";

import {
  buildReceiptVerificationMessage,
  buildReceiptVerificationPath,
} from "@/lib/receipt-verification-url";
import { cn } from "@/lib/utils";

type PaymentReceipt = {
  id: string;
  receiptNumber: string;
  verificationCode: string;
  status: "ISSUED" | "VOIDED";
};

export function PaymentReceiptActions({
  receipt,
  defaultEmail,
}: {
  receipt: PaymentReceipt;
  defaultEmail?: string | null;
}) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const verifyHref = buildReceiptVerificationPath(receipt.receiptNumber, receipt.verificationCode);
  const canSend = receipt.status === "ISSUED" && Boolean(defaultEmail?.trim());

  async function copyVerificationLink() {
    try {
      await navigator.clipboard.writeText(new URL(verifyHref, window.location.origin).toString());
      setTone("success");
      setMessage("Lien copié");
    } catch {
      setTone("error");
      setMessage("Copie impossible");
    }
  }

  async function copyVerificationMessage() {
    const absoluteUrl = new URL(verifyHref, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(
        buildReceiptVerificationMessage({
          receiptNumber: receipt.receiptNumber,
          verificationCode: receipt.verificationCode,
          verificationUrl: absoluteUrl,
        }),
      );
      setTone("success");
      setMessage("Message copié");
    } catch {
      setTone("error");
      setMessage("Copie impossible");
    }
  }

  async function sendReceiptEmail() {
    if (!canSend) {
      setTone("error");
      setMessage(receipt.status === "VOIDED" ? "Reçu annulé" : "Email manquant");
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/receipts/${receipt.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: defaultEmail }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: { email?: string }; error?: string } | null;
      if (!response.ok) {
        setTone("error");
        setMessage(payload?.error ?? "Envoi impossible");
        return;
      }
      setTone("success");
      setMessage(`Envoyé${payload?.data?.email ? ` à ${payload.data.email}` : ""}`);
    } catch {
      setTone("error");
      setMessage("Erreur réseau");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <Link
        href={`/receipts/${receipt.id}`}
        prefetch={false}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-semibold hover:bg-[var(--primary)]/8",
          receipt.status === "VOIDED" ? "text-[var(--danger)]" : "text-[var(--primary)]",
        )}
      >
        <ReceiptText className="size-3" />
        Reçu {receipt.receiptNumber}
        {receipt.status === "VOIDED" ? " annulé" : ""}
      </Link>
      <button
        type="button"
        disabled={isSending || !canSend}
        onClick={sendReceiptEmail}
        title={
          receipt.status === "VOIDED"
            ? "Impossible d'envoyer un reçu annulé"
            : defaultEmail
              ? `Envoyer à ${defaultEmail}`
              : "Aucun email membre disponible"
        }
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Mail className="size-3" />
        {isSending ? "Envoi..." : "Email"}
      </button>
      <button
        type="button"
        onClick={copyVerificationLink}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
      >
        <Copy className="size-3" />
        Copier
      </button>
      <button
        type="button"
        onClick={copyVerificationMessage}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
      >
        <MessageCircle className="size-3" />
        Message
      </button>
      {message ? (
        <span className={cn("text-[0.62rem] font-semibold", tone === "success" ? "text-emerald-700" : "text-red-700")}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
