"use client";

import { QrCode, ReceiptText, ShieldCheck } from "lucide-react";

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
  const prefix = receiptPrefix.trim().toUpperCase() || "WD";
  const parsedSequence = Number.parseInt(nextReceiptSequence, 10);
  const sequence = Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : 1;
  const sampleReceiptNumber = `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`;
  const sampleVerificationCode = "A1B2C3D4E5";
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
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs leading-relaxed text-blue-950">
          <p className="font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Règle de confiance</p>
          <ul className="mt-2 space-y-1.5">
            <li>Chaque reçu déjà émis reste figé et vérifiable avec son numéro et son code.</li>
            <li>Ces réglages changent seulement les prochains reçus créés après enregistrement.</li>
            <li>Modifiez le prochain numéro seulement après reprise manuelle ou alignement comptable.</li>
            <li>L&apos;email automatique ajoute une trace d&apos;envoi, mais ne bloque pas l&apos;encaissement.</li>
          </ul>
        </div>
      </div>

      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <ReceiptText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Apercu recu
            </p>
            <p className="mt-1 text-lg font-black text-[var(--foreground)]">{sampleReceiptNumber}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{clubName.trim() || "Nom du club a completer"}</p>
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
            <PreviewLine label="Formule" value="Mensuel · Discipline" />
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
                  Numéro + code: <span className="font-mono text-[#0B1220]">{sampleVerificationCode}</span>
                </p>
                <p className="mt-1 break-all font-mono text-[0.65rem] text-[var(--muted-foreground)]">
                  /receipts/verify?receiptNumber={sampleReceiptNumber}&code={sampleVerificationCode}
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
          <ReceiptModeLine icon={<ShieldCheck className="size-4" />} label="Sécurité" value="Numéro + code + QR" />
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
