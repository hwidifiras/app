"use client";

import { ShieldCheck } from "lucide-react";

import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormField, FormGrid } from "@/components/ui/form-layout";

export function ClubReceiptSettings({
  clubName,
  receiptPrefix,
  nextReceiptSequence,
  receiptFooter,
  receiptEmailDefault,
  receiptPrintDefault,
  onReceiptPrefixChange,
  onNextReceiptSequenceChange,
  onReceiptFooterChange,
  onReceiptEmailDefaultChange,
  onReceiptPrintDefaultChange,
}: {
  clubName: string;
  receiptPrefix: string;
  nextReceiptSequence: string;
  receiptFooter: string;
  receiptEmailDefault: boolean;
  receiptPrintDefault: boolean;
  onReceiptPrefixChange: (value: string) => void;
  onNextReceiptSequenceChange: (value: string) => void;
  onReceiptFooterChange: (value: string) => void;
  onReceiptEmailDefaultChange: (value: boolean) => void;
  onReceiptPrintDefaultChange: (value: boolean) => void;
}) {
  const prefix = receiptPrefix.trim().toUpperCase() || "WD";
  const parsedSequence = Number.parseInt(nextReceiptSequence, 10);
  const sequence = Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : 1;
  const sampleReceiptNumber = `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`;
  const deliveryMode = receiptEmailDefault
    ? "Email automatique si l'eleve a un email"
    : "Email envoye manuellement";
  const printMode = receiptPrintDefault ? "Impression proposee apres paiement" : "Impression ouverte a la demande";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <FormGrid>
          <FormField
            label="Prefixe des recus"
            htmlFor="receiptPrefix"
            hint="Exemple: WD donne WD-2026-000001."
          >
            <input
              id="receiptPrefix"
              className="field uppercase"
              value={receiptPrefix}
              onChange={(event) => onReceiptPrefixChange(event.target.value.toUpperCase())}
              maxLength={10}
              required
            />
          </FormField>
          <FormField
            label="Prochain numero"
            htmlFor="nextReceiptSequence"
            hint="Augmente automatiquement apres chaque paiement."
          >
            <input
              id="nextReceiptSequence"
              type="number"
              min={1}
              step={1}
              className="field"
              value={nextReceiptSequence}
              onChange={(event) => onNextReceiptSequenceChange(event.target.value)}
              required
            />
          </FormField>
          <FormField
            label="Texte en bas du recu"
            htmlFor="receiptFooter"
            hint="Conditions, merci, cachet du club ou mention administrative."
            className="md:col-span-2"
          >
            <textarea
              id="receiptFooter"
              className="field min-h-24"
              value={receiptFooter}
              onChange={(event) => onReceiptFooterChange(event.target.value)}
              maxLength={500}
            />
          </FormField>
        </FormGrid>
        <div className="grid gap-3 md:grid-cols-2">
          <SettingsToggleRow
            id="receiptPrintDefault"
            label="Proposer l'impression apres paiement"
            description="Affiche un lien direct vers le recu imprimable apres un encaissement."
            checked={receiptPrintDefault}
            onChange={onReceiptPrintDefaultChange}
          />
          <SettingsToggleRow
            id="receiptEmailDefault"
            label="Envoi email par defaut"
            description="Apres un encaissement, le recu est envoye automatiquement si le membre possede un email."
            checked={receiptEmailDefault}
            onChange={onReceiptEmailDefaultChange}
          />
        </div>
      </div>

      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Apercu recu
            </p>
            <p className="mt-1 text-lg font-black text-[var(--foreground)]">{sampleReceiptNumber}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{clubName.trim() || "Nom du club a completer"}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <dt className="font-semibold text-[var(--muted-foreground)]">Verification</dt>
            <dd className="font-bold text-[var(--foreground)]">Code + QR</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <dt className="font-semibold text-[var(--muted-foreground)]">Impression</dt>
            <dd className="text-right font-bold text-[var(--foreground)]">{printMode}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <dt className="font-semibold text-[var(--muted-foreground)]">Email</dt>
            <dd className="text-right font-bold text-[var(--foreground)]">{deliveryMode}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          Les recus deja emis gardent leur snapshot. Changer ces reglages affecte seulement les prochains paiements.
        </p>
      </aside>
    </div>
  );
}
