"use client";

import { useState } from "react";
import { ChevronDown, QrCode, ReceiptText, ShieldCheck } from "lucide-react";

import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormField, FormGrid } from "@/components/ui/form-layout";
import { formatMoney } from "@/lib/money";

export function ClubReceiptSettings({
  clubName,
  receiptLegalName,
  receiptTaxId,
  receiptPrefix,
  nextReceiptSequence,
  receiptFooter,
  receiptEmailDefault,
  receiptPrintDefault,
  onReceiptPrefixChange,
  onNextReceiptSequenceChange,
  onReceiptFooterChange,
  onReceiptLegalNameChange,
  onReceiptTaxIdChange,
  onReceiptEmailDefaultChange,
  onReceiptPrintDefaultChange,
}: {
  clubName: string;
  receiptLegalName: string;
  receiptTaxId: string;
  receiptPrefix: string;
  nextReceiptSequence: string;
  receiptFooter: string;
  receiptEmailDefault: boolean;
  receiptPrintDefault: boolean;
  onReceiptPrefixChange: (value: string) => void;
  onNextReceiptSequenceChange: (value: string) => void;
  onReceiptFooterChange: (value: string) => void;
  onReceiptLegalNameChange: (value: string) => void;
  onReceiptTaxIdChange: (value: string) => void;
  onReceiptEmailDefaultChange: (value: boolean) => void;
  onReceiptPrintDefaultChange: (value: boolean) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const prefix = receiptPrefix.trim().toUpperCase() || "WD";
  const parsedSequence = Number.parseInt(nextReceiptSequence, 10);
  const sequence = Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : 1;
  const sampleReceiptNumber = `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`;
  const sampleVerificationCode = "A1B2C3D4E5";
  const deliveryMode = receiptEmailDefault ? "Automatique si email" : "Manuel";
  const printMode = receiptPrintDefault ? "Après paiement" : "À la demande";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-sm leading-relaxed text-blue-950">
          <p className="font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Reçu simple et vérifiable</p>
          <p className="mt-1">
            Choisissez ce qui se passe après un encaissement. Les numéros, codes et QR restent disponibles dans les
            options avancées.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SettingsToggleRow
            id="receiptPrintDefault"
            label="Proposer l'impression après paiement"
            description="Affiche un lien direct vers le reçu imprimable après un encaissement."
            checked={receiptPrintDefault}
            onChange={onReceiptPrintDefaultChange}
          />
          <SettingsToggleRow
            id="receiptEmailDefault"
            label="Envoyer par email si possible"
            description="Envoie le reçu automatiquement quand le membre possède une adresse email."
            checked={receiptEmailDefault}
            onChange={onReceiptEmailDefaultChange}
          />
        </div>

        <FormField
          label="Message en bas du reçu"
          htmlFor="receiptFooter"
          hint="Conditions, merci, cachet du club ou mention administrative."
        >
          <textarea
            id="receiptFooter"
            className="field min-h-24"
            value={receiptFooter}
            onChange={(event) => onReceiptFooterChange(event.target.value)}
            maxLength={500}
          />
        </FormField>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span>
              <span className="block text-sm font-bold text-[var(--foreground)]">Options avancées</span>
              <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                Numérotation, nom légal et identifiant fiscal.
              </span>
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {advancedOpen ? (
            <div className="border-t border-[var(--border)] p-4">
              <FormGrid>
                <FormField
                  label="Préfixe des reçus"
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
                  label="Prochain numéro"
                  htmlFor="nextReceiptSequence"
                  hint="Augmente automatiquement après chaque paiement."
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
                  label="Nom légal sur reçu"
                  htmlFor="receiptLegalName"
                  hint="Facultatif: raison sociale ou nom administratif imprimé sur les reçus."
                >
                  <input
                    id="receiptLegalName"
                    className="field"
                    value={receiptLegalName}
                    onChange={(event) => onReceiptLegalNameChange(event.target.value)}
                    maxLength={160}
                    placeholder="Ex. Association Sportive..."
                  />
                </FormField>
                <FormField
                  label="Identifiant fiscal"
                  htmlFor="receiptTaxId"
                  hint="Facultatif: matricule fiscal, identifiant association ou référence administrative."
                >
                  <input
                    id="receiptTaxId"
                    className="field"
                    value={receiptTaxId}
                    onChange={(event) => onReceiptTaxIdChange(event.target.value)}
                    maxLength={80}
                    placeholder="Ex. MF / ID..."
                  />
                </FormField>
              </FormGrid>

              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs leading-relaxed text-blue-950">
                <p className="font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Confiance</p>
                <p className="mt-1">
                  Les reçus déjà émis restent inchangés et vérifiables. Le prochain numéro doit être modifié seulement
                  après reprise manuelle ou alignement comptable.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <ReceiptText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Aperçu reçu
            </p>
            <p className="mt-1 text-lg font-black text-[var(--foreground)]">{sampleReceiptNumber}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{clubName.trim() || "Nom du club à compléter"}</p>
            {receiptLegalName.trim() ? (
              <p className="mt-1 text-xs font-semibold text-[var(--foreground)]">{receiptLegalName.trim()}</p>
            ) : null}
            {receiptTaxId.trim() ? (
              <p className="mt-0.5 text-[0.68rem] text-[var(--muted-foreground)]">ID fiscal: {receiptTaxId.trim()}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <PreviewLine label="Membre" value="Élève exemple" />
            <PreviewLine label="Formule" value="Mensuel - Discipline" />
            <PreviewLine label="Paiement" value={formatMoney(4000)} />
            <PreviewLine label="Reste" value={formatMoney(0)} />
          </div>
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-[var(--primary)]">
                <QrCode className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#0B1220]">Vérification publique</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  QR + code: <span className="font-mono text-[#0B1220]">{sampleVerificationCode}</span>
                </p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  Le QR confirme le statut du reçu sur une page publique.
                </p>
              </div>
            </div>
          </div>

          {receiptFooter.trim() ? (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <p className="font-semibold text-[var(--muted-foreground)]">Bas du reçu</p>
              <p className="mt-1 whitespace-pre-wrap text-[#0B1220]">{receiptFooter.trim()}</p>
            </div>
          ) : null}

          <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Reçu vérifiable
          </p>
        </div>

        <dl className="mt-4 space-y-2 text-xs">
          <ReceiptModeLine icon={<ShieldCheck className="size-4" />} label="Sécurité" value="QR + code" />
          <ReceiptModeLine label="Impression" value={printMode} />
          <ReceiptModeLine label="Email" value={deliveryMode} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          Les reçus déjà émis restent inchangés. Changer ces réglages affecte seulement les prochains paiements.
        </p>
      </aside>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
      <p className="font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 truncate font-bold text-[#0B1220]">{value}</p>
    </div>
  );
}

function ReceiptModeLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <dt className="flex items-center gap-2 font-semibold text-[var(--muted-foreground)]">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-bold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
