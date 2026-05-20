"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormField, FormGrid, FormSection } from "@/components/ui/form-layout";

export type ClubSettingsFormData = {
  clubName: string;
  clubAddress: string;
  clubPhone: string;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
  updatedAt: string;
};

type ClubSettingsFormProps = {
  initial: ClubSettingsFormData;
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/80 bg-[var(--surface-soft)]/60 p-3.5 transition hover:border-primary/25 sm:p-4"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="absolute inset-0 rounded-full bg-muted transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
          aria-hidden
        />
        <span
          className="relative ml-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5"
          aria-hidden
        />
      </span>
    </label>
  );
}

function centsToEurosInput(cents: number): string {
  if (cents <= 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function eurosInputToCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const euros = Number.parseFloat(normalized);
  if (Number.isNaN(euros) || euros < 0) return Number.NaN;
  return Math.round(euros * 100);
}

export function ClubSettingsForm({ initial }: ClubSettingsFormProps) {
  const router = useRouter();
  const [clubName, setClubName] = useState(initial.clubName);
  const [clubAddress, setClubAddress] = useState(initial.clubAddress);
  const [clubPhone, setClubPhone] = useState(initial.clubPhone);
  const [allowPartialPayment, setAllowPartialPayment] = useState(initial.allowCheckInWithPartialPayment);
  const [allowWithoutSubscription, setAllowWithoutSubscription] = useState(
    initial.allowCheckInWithoutSubscription,
  );
  const [maxStaffDiscountPercent, setMaxStaffDiscountPercent] = useState(
    String(initial.maxStaffDiscountPercent),
  );
  const [debtThresholdEuros, setDebtThresholdEuros] = useState(centsToEurosInput(initial.debtAlertThresholdCents));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const discount = Number.parseInt(maxStaffDiscountPercent, 10);
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      setMessage("La réduction staff doit être entre 0 et 100 %");
      return;
    }

    const debtAlertThresholdCents = eurosInputToCents(debtThresholdEuros);
    if (Number.isNaN(debtAlertThresholdCents)) {
      setMessage("Seuil dette invalide (ex. 15 ou 15,00)");
      return;
    }

    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/club-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clubName,
        clubAddress,
        clubPhone,
        allowCheckInWithPartialPayment: allowPartialPayment,
        allowCheckInWithoutSubscription: allowWithoutSubscription,
        maxStaffDiscountPercent: discount,
        debtAlertThresholdCents,
      }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok || !json.data) {
      setMessage(json?.error ?? "Erreur lors de l'enregistrement");
      return;
    }

    setClubName(json.data.clubName);
    setClubAddress(json.data.clubAddress);
    setClubPhone(json.data.clubPhone);
    setAllowPartialPayment(json.data.allowCheckInWithPartialPayment);
    setAllowWithoutSubscription(json.data.allowCheckInWithoutSubscription);
    setMaxStaffDiscountPercent(String(json.data.maxStaffDiscountPercent));
    setDebtThresholdEuros(centsToEurosInput(json.data.debtAlertThresholdCents));
    setMessage("Règles du club enregistrées");
    router.refresh();
  }

  const updatedLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(initial.updatedAt));

  return (
    <form onSubmit={submit} className="space-y-5">
      <FeedbackMessage message={message} />

      <FormSection title="Identité du club" description="Affichée dans l'interface et les communications.">
        <FormGrid cols={1}>
          <FormField label="Nom du club" htmlFor="clubName">
            <input
              id="clubName"
              className="field"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="Ex. Club Karaté Tunis"
            />
          </FormField>
          <FormField label="Adresse" htmlFor="clubAddress">
            <input
              id="clubAddress"
              className="field"
              value={clubAddress}
              onChange={(e) => setClubAddress(e.target.value)}
              placeholder="Rue, ville"
            />
          </FormField>
          <FormField label="Téléphone" htmlFor="clubPhone">
            <input
              id="clubPhone"
              className="field"
              value={clubPhone}
              onChange={(e) => setClubPhone(e.target.value)}
              placeholder="+216 ..."
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Pointage & paiements"
        description="Politique de pointage à la réception."
      >
        <div className="space-y-3">
          <ToggleRow
            id="allowPartialPayment"
            label="Pointage avec paiement partiel"
            description="Un membre ayant payé une partie de son abonnement peut être pointé présent."
            checked={allowPartialPayment}
            onChange={setAllowPartialPayment}
          />
          <ToggleRow
            id="allowWithoutSubscription"
            label="Pointage sans abonnement (exception)"
            description="Autorise un passage exceptionnel avec motif si aucun abonnement actif. Sinon, refusé même en exception."
            checked={allowWithoutSubscription}
            onChange={setAllowWithoutSubscription}
          />
        </div>
      </FormSection>

      <FormSection title="Alertes & offres" description="Dashboard et remises staff.">
        <FormGrid cols={1}>
          <FormField
            label="Seuil dette affichée (€)"
            htmlFor="debtThreshold"
            hint="Laisser vide ou 0 pour tout afficher. Ex. 15 = masquer les dettes sous 15 €."
          >
            <input
              id="debtThreshold"
              type="text"
              inputMode="decimal"
              className="field max-w-[10rem]"
              value={debtThresholdEuros}
              onChange={(e) => setDebtThresholdEuros(e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField
            label="Réduction maximale staff (%)"
            htmlFor="maxStaffDiscount"
            hint="0–100. Les administrateurs peuvent toujours aller jusqu'à 100 %."
          >
            <input
              id="maxStaffDiscount"
              type="number"
              min={0}
              max={100}
              step={1}
              className="field max-w-[8rem]"
              value={maxStaffDiscountPercent}
              onChange={(e) => setMaxStaffDiscountPercent(e.target.value)}
              required
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <p className="text-xs text-muted-foreground">
        Comptes staff : <span className="font-medium text-foreground">Paramètres → Utilisateurs</span>.
      </p>
      <p className="text-xs text-muted-foreground">Dernière modification : {updatedLabel}</p>

      <FormActions>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer les règles"}
        </button>
      </FormActions>
    </form>
  );
}
