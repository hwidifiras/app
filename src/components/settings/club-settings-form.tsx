"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormField, FormGrid, FormSection, FormSectionNav } from "@/components/ui/form-layout";
import { FieldControl } from "@/components/ui/field-control";
import { cn } from "@/lib/utils";

export type ClubSettingsFormData = {
  clubName: string;
  clubLogoUrl: string;
  clubAddress: string;
  clubPhone: string;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  absentConsumesSession: boolean;
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
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
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3.5 transition sm:p-4",
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-border/80 bg-[var(--surface-soft)]/60 hover:border-primary/25",
      )}
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
  const [clubLogoUrl, setClubLogoUrl] = useState(initial.clubLogoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [clubAddress, setClubAddress] = useState(initial.clubAddress);
  const [clubPhone, setClubPhone] = useState(initial.clubPhone);
  const [allowPartialPayment, setAllowPartialPayment] = useState(initial.allowCheckInWithPartialPayment);
  const [allowWithoutSubscription, setAllowWithoutSubscription] = useState(
    initial.allowCheckInWithoutSubscription,
  );
  const [absentConsumesSession, setAbsentConsumesSession] = useState(initial.absentConsumesSession);
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
      setMessage("La réduction maximale de l'équipe doit être comprise entre 0 et 100 %");
      return;
    }

    const debtAlertThresholdCents = eurosInputToCents(debtThresholdEuros);
    if (Number.isNaN(debtAlertThresholdCents)) {
      setMessage("Le seuil de dette doit être un montant positif, par exemple 15 €");
      return;
    }

    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/club-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clubName,
        clubLogoUrl,
        clubAddress,
        clubPhone,
        allowCheckInWithPartialPayment: allowPartialPayment,
        allowCheckInWithoutSubscription: allowWithoutSubscription,
        absentConsumesSession,
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
    setClubLogoUrl(json.data.clubLogoUrl ?? "");
    setClubAddress(json.data.clubAddress);
    setClubPhone(json.data.clubPhone);
    setAllowPartialPayment(json.data.allowCheckInWithPartialPayment);
    setAllowWithoutSubscription(json.data.allowCheckInWithoutSubscription);
    setAbsentConsumesSession(json.data.absentConsumesSession);
    setMaxStaffDiscountPercent(String(json.data.maxStaffDiscountPercent));
    setDebtThresholdEuros(centsToEurosInput(json.data.debtAlertThresholdCents));
    setMessage("Club enregistré");
    router.refresh();
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setMessage(null);
    const body = new FormData();
    body.append("logo", file);
    const res = await fetch("/api/club-settings/logo", { method: "POST", body });
    let json: { data?: { clubLogoUrl?: string }; error?: string } = {};
    try {
      json = await res.json();
    } catch {
      setLogoUploading(false);
      setMessage("Impossible d'importer le logo pour le moment");
      return;
    }
    setLogoUploading(false);
    if (!res.ok || !json.data) {
      setMessage(json?.error ?? "Échec du téléversement du logo");
      return;
    }
    setClubLogoUrl(json.data.clubLogoUrl ?? "");
    setMessage("Logo mis à jour");
    router.refresh();
  }

  async function removeLogo() {
    setLogoUploading(true);
    setMessage(null);
    const res = await fetch("/api/club-settings/logo", { method: "DELETE" });
    let json: { error?: string } = {};
    try {
      json = await res.json();
    } catch {
      setLogoUploading(false);
      setMessage("Impossible de supprimer le logo pour le moment");
      return;
    }
    setLogoUploading(false);
    if (!res.ok) {
      setMessage(json?.error ?? "Échec de la suppression du logo");
      return;
    }
    setClubLogoUrl("");
    setMessage("Logo supprimé");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <FeedbackMessage message={message} />

      <FormSectionNav
        items={[
          { href: "#club-identity", label: "Identité" },
          { href: "#club-checkin", label: "Pointage" },
          { href: "#club-alerts", label: "Alertes" },
        ]}
      />

      <FormSection
        id="club-identity"
        title="Identité du club"
        description="Ces informations apparaissent dans l'application et sur les écrans d'accueil."
      >
        <FormGrid>
          <FormField
            label="Nom du club"
            htmlFor="clubName"
            hint="Laissez vide pour conserver le nom actuel de l'application."
            className="md:col-span-2"
          >
            <input
              id="clubName"
              className="field"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="Ex. Club Karaté Tunis"
            />
          </FormField>
          <FormField
            label="Logo du club"
            htmlFor="clubLogoFile"
            hint="Image PNG, JPEG ou WebP, jusqu'à 1 Mo."
            className="md:col-span-2"
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-[var(--surface-soft)]">
                {clubLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clubLogoUrl} alt="" className="size-full object-contain p-1" />
                ) : (
                  <span className="text-xs text-muted-foreground">Aucun</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  id="clubLogoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={logoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="clubLogoFile"
                  className={`btn btn-primary btn-block-mobile inline-flex min-h-11 cursor-pointer items-center justify-center text-sm sm:w-fit ${
                    logoUploading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  {logoUploading ? "Importation…" : "Choisir une image"}
                </label>
                {clubLogoUrl ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-block-mobile min-h-11 text-sm sm:w-fit"
                    disabled={logoUploading}
                    onClick={() => void removeLogo()}
                  >
                    Supprimer le logo
                  </button>
                ) : null}
              </div>
            </div>
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
              inputMode="tel"
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        id="club-checkin"
        title="Pointage & paiements"
        description="Définissez ce que l'équipe peut accepter pendant le pointage."
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
            label="Autoriser exceptionnellement sans abonnement"
            description="L'équipe pourra enregistrer un passage motivé pour une personne sans abonnement actif."
            checked={allowWithoutSubscription}
            onChange={setAllowWithoutSubscription}
          />
          <ToggleRow
            id="absentConsumesSession"
            label="Une absence consomme une séance"
            description="Lorsqu'elle est activée, une absence déduit une séance du quota restant."
            checked={absentConsumesSession}
            onChange={setAbsentConsumesSession}
          />
        </div>
      </FormSection>

      <FormSection
        id="club-alerts"
        title="Alertes et remises"
        description="Réglez les montants visibles et la marge de remise accordée à l'équipe."
      >
        <FormGrid>
          <FormField
            label="Afficher les dettes à partir de"
            htmlFor="debtThreshold"
            hint="Laissez vide ou saisissez 0 pour afficher toutes les dettes."
          >
            <FieldControl suffix="€">
              <input
                id="debtThreshold"
                type="text"
                inputMode="decimal"
                className="field pr-10"
                value={debtThresholdEuros}
                onChange={(e) => setDebtThresholdEuros(e.target.value)}
                placeholder="0"
              />
            </FieldControl>
          </FormField>
          <FormField
            label="Réduction maximale de l'équipe"
            htmlFor="maxStaffDiscount"
            hint="Limite appliquée aux comptes non administrateurs."
          >
            <FieldControl suffix="%">
              <input
                id="maxStaffDiscount"
                type="number"
                min={0}
                max={100}
                step={1}
                className="field pr-10"
                value={maxStaffDiscountPercent}
                onChange={(e) => setMaxStaffDiscountPercent(e.target.value)}
                required
              />
            </FieldControl>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormActions sticky>
        <button type="submit" className="btn btn-primary btn-block-mobile" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
      </FormActions>
    </form>
  );
}
