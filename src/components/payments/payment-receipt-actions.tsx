"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Mail, MessageCircle, ReceiptText } from "lucide-react";

import { DemoMutationButton } from "@/components/ui/demo-read-only";
import {
  buildReceiptVerificationMessage,
  buildReceiptVerificationPath,
} from "@/lib/receipt-verification-url";
import type { ReceiptDeliveryStatus } from "@/lib/receipt-delivery-status";
import { cn } from "@/lib/utils";

type PaymentReceipt = {
  id: string;
  receiptNumber: string;
  verificationCode: string;
  status: "ISSUED" | "VOIDED";
  deliveryStatus?: ReceiptDeliveryStatus | null;
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
  const [deliveryStatus, setDeliveryStatus] = useState<ReceiptDeliveryStatus | null>(
    receipt.deliveryStatus ?? null,
  );
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
      setDeliveryStatus({
        delivered: true,
        email: payload?.data?.email ?? defaultEmail ?? null,
        createdAt: new Date().toISOString(),
        reason: null,
      });
    } catch {
      setTone("error");
      setMessage("Erreur réseau");
      setDeliveryStatus({
        delivered: false,
        email: defaultEmail ?? null,
        createdAt: new Date().toISOString(),
        reason: "Erreur réseau",
      });
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
      <ReceiptDeliveryChip
        receiptStatus={receipt.status}
        deliveryStatus={deliveryStatus}
        hasEmail={Boolean(defaultEmail?.trim())}
      />
      <DemoMutationButton
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
      </DemoMutationButton>
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

export function ReceiptDeliveryChip({
  receiptStatus,
  deliveryStatus,
  hasEmail,
}: {
  receiptStatus: PaymentReceipt["status"];
  deliveryStatus: ReceiptDeliveryStatus | null;
  hasEmail: boolean;
}) {
  if (receiptStatus === "VOIDED") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[0.6rem] font-semibold text-red-700">
        Envoi bloqué
      </span>
    );
  }

  if (deliveryStatus) {
    const sentAt = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(deliveryStatus.createdAt));
    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold",
          deliveryStatus.delivered ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
        )}
        title={[
          deliveryStatus.email ? `Email: ${deliveryStatus.email}` : null,
          `Date: ${sentAt}`,
          !deliveryStatus.delivered && deliveryStatus.reason ? `Motif: ${deliveryStatus.reason}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {deliveryStatus.delivered ? "Email envoyé" : "Email échoué"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold",
        hasEmail ? "bg-[var(--surface-soft)] text-[var(--muted-foreground)]" : "bg-amber-50 text-amber-700",
      )}
      title={hasEmail ? "Aucun envoi email enregistré pour ce reçu" : "Ajoutez un email au membre pour envoyer le reçu"}
    >
      {hasEmail ? "Non envoyé" : "Email manquant"}
    </span>
  );
}
