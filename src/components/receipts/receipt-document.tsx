import { BadgeCheck, CircleSlash } from "lucide-react";

import { formatMoney } from "@/lib/money";
import type { ReceiptSnapshot } from "@/lib/receipts";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function methodLabel(value: string | null) {
  if (!value) return "Non precise";
  if (value === "CASH") return "Especes";
  if (value === "CARD") return "Carte";
  if (value === "TRANSFER") return "Virement";
  return value;
}

export function ReceiptDocument({
  snapshot,
  status,
  publicMode = false,
  verificationUrl,
}: {
  snapshot: ReceiptSnapshot;
  status: "ISSUED" | "VOIDED";
  publicMode?: boolean;
  verificationUrl?: string;
}) {
  const isVoided = status === "VOIDED";
  const memberName = publicMode
    ? snapshot.member.name
        .split(" ")
        .filter(Boolean)
        .map((part, index) => (index === 0 ? part : `${part[0] ?? ""}.`))
        .join(" ")
    : snapshot.member.name;

  return (
    <article className="mx-auto max-w-3xl rounded-lg border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-panel)] print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">Recu de paiement</p>
          <h1 className="mt-2 text-2xl font-black tracking-normal text-[#0B1220]">{snapshot.receipt.receiptNumber}</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Emis le {formatDate(snapshot.receipt.issuedAt)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
          <p className="font-bold text-[#0B1220]">{snapshot.club.name}</p>
          {snapshot.club.address ? <p className="mt-1 text-[var(--muted-foreground)]">{snapshot.club.address}</p> : null}
          {snapshot.club.phone ? <p className="mt-1 text-[var(--muted-foreground)]">{snapshot.club.phone}</p> : null}
        </div>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Membre</p>
          <p className="mt-1 font-bold text-[#0B1220]">{memberName || "-"}</p>
          {!publicMode && snapshot.member.phone ? (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{snapshot.member.phone}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Formule</p>
          <p className="mt-1 font-bold text-[#0B1220]">{snapshot.subscription.planName}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{snapshot.subscription.sportName}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Statut</p>
          <p className={isVoided ? "mt-1 inline-flex items-center gap-2 font-bold text-red-700" : "mt-1 inline-flex items-center gap-2 font-bold text-emerald-700"}>
            {isVoided ? <CircleSlash className="size-4" /> : <BadgeCheck className="size-4" />}
            {isVoided ? "Annule" : "Valide"}
          </p>
        </div>
      </div>

      <section className="mt-5 rounded-lg border border-[var(--border)]">
        <div className="grid grid-cols-2 border-b border-[var(--border)] p-3 text-sm sm:grid-cols-4">
          <span className="font-semibold text-[var(--muted-foreground)]">Paiement</span>
          <span className="font-bold text-[#0B1220]">{formatMoney(snapshot.payment.amountCents)}</span>
          <span className="font-semibold text-[var(--muted-foreground)]">Mode</span>
          <span className="font-bold text-[#0B1220]">{methodLabel(snapshot.payment.paymentMethod)}</span>
        </div>
        <div className="grid grid-cols-2 border-b border-[var(--border)] p-3 text-sm sm:grid-cols-4">
          <span className="font-semibold text-[var(--muted-foreground)]">Total formule</span>
          <span className="font-bold text-[#0B1220]">{formatMoney(snapshot.subscription.amountCents)}</span>
          <span className="font-semibold text-[var(--muted-foreground)]">Total paye</span>
          <span className="font-bold text-[#0B1220]">{formatMoney(snapshot.totals.paidAfterCents)}</span>
        </div>
        <div className="grid grid-cols-2 p-3 text-sm sm:grid-cols-4">
          <span className="font-semibold text-[var(--muted-foreground)]">Reste</span>
          <span className="font-bold text-[#0B1220]">{formatMoney(snapshot.totals.remainingAfterCents)}</span>
          <span className="font-semibold text-[var(--muted-foreground)]">Verification</span>
          <span className="font-bold text-[#0B1220]">{snapshot.receipt.verificationCode}</span>
        </div>
      </section>

      {snapshot.payment.notes && !publicMode ? (
        <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
          <p className="font-semibold text-[var(--muted-foreground)]">Note</p>
          <p className="mt-1 text-[#0B1220]">{snapshot.payment.notes}</p>
        </section>
      ) : null}

      <footer className="mt-5 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted-foreground)]">
        <p>Ce recu est verifiable avec le numero et le code de verification.</p>
        {verificationUrl ? (
          <p className="mt-1 break-all">
            Lien verification: <span className="font-mono text-[#0B1220]">{verificationUrl}</span>
          </p>
        ) : null}
        {snapshot.club.footer ? <p className="mt-1">{snapshot.club.footer}</p> : null}
        <p className="mt-1 font-mono text-[0.68rem]">Hash: {snapshot.receipt.contentHash}</p>
      </footer>
    </article>
  );
}
