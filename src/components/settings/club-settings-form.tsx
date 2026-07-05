"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClubIdentitySection } from "@/components/settings/club-identity-section";
import { ClubPlanningRulesSection } from "@/components/settings/club-planning-rules-section";
import { ClubReceiptSettings } from "@/components/settings/club-receipt-settings";
import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormField, FormGrid, FormSection, FormSectionNav } from "@/components/ui/form-layout";
import { FieldControl } from "@/components/ui/field-control";
import {
  DEFAULT_WORKING_DAYS,
  WORKING_DAY_ORDER,
  type ClubDay,
} from "@/lib/club-working-days";
import { MONEY_INPUT_SUFFIX } from "@/lib/money";

export type ClubSettingsFormData = {
  clubName: string;
  clubLogoUrl: string;
  clubAddress: string;
  clubPhone: string;
  receiptLegalName: string;
  receiptTaxId: string;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  absentConsumesSession: boolean;
  allowSameRoomConcurrentGroups: boolean;
  allowCoachConcurrentSameRoomQualified: boolean;
  workingDays: ClubDay[];
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
  receiptPrefix: string;
  nextReceiptSequence: number;
  receiptFooter: string;
  receiptEmailDefault: boolean;
  receiptPrintDefault: boolean;
};

type ClubSettingsFormProps = {
  initial: ClubSettingsFormData;
};

function centsToMoneyInput(cents: number): string {
  if (cents <= 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function moneyInputToCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

export function ClubSettingsForm({ initial }: ClubSettingsFormProps) {
  const router = useRouter();
  const [clubName, setClubName] = useState(initial.clubName);
  const [clubLogoUrl, setClubLogoUrl] = useState(initial.clubLogoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [clubAddress, setClubAddress] = useState(initial.clubAddress);
  const [clubPhone, setClubPhone] = useState(initial.clubPhone);
  const [receiptLegalName, setReceiptLegalName] = useState(initial.receiptLegalName);
  const [receiptTaxId, setReceiptTaxId] = useState(initial.receiptTaxId);
  const [allowPartialPayment, setAllowPartialPayment] = useState(initial.allowCheckInWithPartialPayment);
  const [allowWithoutSubscription, setAllowWithoutSubscription] = useState(
    initial.allowCheckInWithoutSubscription,
  );
  const [absentConsumesSession, setAbsentConsumesSession] = useState(initial.absentConsumesSession);
  const [allowSameRoomConcurrentGroups, setAllowSameRoomConcurrentGroups] = useState(
    initial.allowSameRoomConcurrentGroups,
  );
  const [allowCoachConcurrentSameRoomQualified, setAllowCoachConcurrentSameRoomQualified] = useState(
    initial.allowCoachConcurrentSameRoomQualified,
  );
  const [workingDays, setWorkingDays] = useState<ClubDay[]>(
    initial.workingDays.length > 0 ? initial.workingDays : [...DEFAULT_WORKING_DAYS],
  );
  const [maxStaffDiscountPercent, setMaxStaffDiscountPercent] = useState(
    String(initial.maxStaffDiscountPercent),
  );
  const [debtThresholdAmount, setDebtThresholdAmount] = useState(centsToMoneyInput(initial.debtAlertThresholdCents));
  const [receiptPrefix, setReceiptPrefix] = useState(initial.receiptPrefix || "WD");
  const [nextReceiptSequence, setNextReceiptSequence] = useState(String(initial.nextReceiptSequence || 1));
  const [receiptFooter, setReceiptFooter] = useState(initial.receiptFooter || "");
  const [receiptEmailDefault, setReceiptEmailDefault] = useState(initial.receiptEmailDefault);
  const [receiptPrintDefault, setReceiptPrintDefault] = useState(initial.receiptPrintDefault);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const discount = Number.parseInt(maxStaffDiscountPercent, 10);
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      setMessage("La réduction maximale de l'équipe doit être comprise entre 0 et 100 %");
      return;
    }

    const debtAlertThresholdCents = moneyInputToCents(debtThresholdAmount);
    if (Number.isNaN(debtAlertThresholdCents)) {
      setMessage("Le seuil de dette doit être un montant positif, par exemple 15 TND");
      return;
    }

    if (workingDays.length === 0) {
      setMessage("Selectionnez au moins un jour d'ouverture du club");
      return;
    }

    const receiptSequence = Number.parseInt(nextReceiptSequence, 10);
    if (!/^[A-Za-z0-9-]{2,10}$/.test(receiptPrefix.trim())) {
      setMessage("Le prefixe des recus doit contenir 2 a 10 caracteres: lettres, chiffres ou tirets");
      return;
    }
    if (Number.isNaN(receiptSequence) || receiptSequence < 1) {
      setMessage("Le prochain numero de recu doit etre superieur ou egal a 1");
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
        receiptLegalName: receiptLegalName.trim(),
        receiptTaxId: receiptTaxId.trim(),
        allowCheckInWithPartialPayment: allowPartialPayment,
        allowCheckInWithoutSubscription: allowWithoutSubscription,
        absentConsumesSession,
        allowSameRoomConcurrentGroups,
        allowCoachConcurrentSameRoomQualified,
        workingDays,
        maxStaffDiscountPercent: discount,
        debtAlertThresholdCents,
        receiptPrefix: receiptPrefix.trim().toUpperCase(),
        nextReceiptSequence: receiptSequence,
        receiptFooter: receiptFooter.trim(),
        receiptEmailDefault,
        receiptPrintDefault,
      }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok || !json.data) {
      const blockedDays = Array.isArray(json?.details?.blockedDays)
        ? json.details.blockedDays.filter((day: unknown): day is ClubDay => WORKING_DAY_ORDER.includes(day as ClubDay))
        : [];
      if (blockedDays.length > 0) {
        setWorkingDays((current) => {
          const selected = new Set([...current, ...blockedDays]);
          return WORKING_DAY_ORDER.filter((day) => selected.has(day));
        });
      }
      const details = Array.isArray(json?.details?.workingDays)
        ? json.details.workingDays.filter((line: unknown): line is string => typeof line === "string")
        : [];
      setMessage([json?.error ?? "Erreur lors de l'enregistrement", ...details].join(" "));
      return;
    }

    setClubName(json.data.clubName);
    setClubLogoUrl(json.data.clubLogoUrl ?? "");
    setClubAddress(json.data.clubAddress);
    setClubPhone(json.data.clubPhone);
    setReceiptLegalName(json.data.receiptLegalName ?? "");
    setReceiptTaxId(json.data.receiptTaxId ?? "");
    setAllowPartialPayment(json.data.allowCheckInWithPartialPayment);
    setAllowWithoutSubscription(json.data.allowCheckInWithoutSubscription);
    setAbsentConsumesSession(json.data.absentConsumesSession);
    setAllowSameRoomConcurrentGroups(json.data.allowSameRoomConcurrentGroups);
    setAllowCoachConcurrentSameRoomQualified(json.data.allowCoachConcurrentSameRoomQualified);
    setWorkingDays(json.data.workingDays?.length ? json.data.workingDays : [...DEFAULT_WORKING_DAYS]);
    setMaxStaffDiscountPercent(String(json.data.maxStaffDiscountPercent));
    setDebtThresholdAmount(centsToMoneyInput(json.data.debtAlertThresholdCents));
    setReceiptPrefix(json.data.receiptPrefix ?? "WD");
    setNextReceiptSequence(String(json.data.nextReceiptSequence ?? 1));
    setReceiptFooter(json.data.receiptFooter ?? "");
    setReceiptEmailDefault(Boolean(json.data.receiptEmailDefault));
    setReceiptPrintDefault(json.data.receiptPrintDefault !== false);
    setMessage("Club enregistré");
    router.refresh();
  }

  function toggleWorkingDay(day: ClubDay, checked: boolean) {
    setWorkingDays((current) => {
      const selected = new Set(current);
      if (checked) {
        selected.add(day);
      } else if (selected.size > 1) {
        selected.delete(day);
      }
      return WORKING_DAY_ORDER.filter((item) => selected.has(item));
    });
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
          { href: "#club-planning", label: "Planning" },
          { href: "#club-alerts", label: "Alertes" },
          { href: "#club-receipts", label: "Recus" },
        ]}
      />

      <ClubIdentitySection
        clubName={clubName}
        clubLogoUrl={clubLogoUrl}
        logoUploading={logoUploading}
        clubAddress={clubAddress}
        clubPhone={clubPhone}
        onClubNameChange={setClubName}
        onClubAddressChange={setClubAddress}
        onClubPhoneChange={setClubPhone}
        onUploadLogo={(file) => void uploadLogo(file)}
        onRemoveLogo={() => void removeLogo()}
      />

      <FormSection
        id="club-checkin"
        title="Pointage & paiements"
        description="Définissez ce que l'équipe peut accepter pendant le pointage."
      >
        <div className="space-y-3">
          <SettingsToggleRow
            id="allowPartialPayment"
            label="Pointage avec paiement partiel"
            description="Un membre ayant payé une partie de son abonnement peut être pointé présent."
            checked={allowPartialPayment}
            onChange={setAllowPartialPayment}
          />
          <SettingsToggleRow
            id="allowWithoutSubscription"
            label="Autoriser exceptionnellement sans abonnement"
            description="L'équipe pourra enregistrer un passage motivé pour une personne sans abonnement actif."
            checked={allowWithoutSubscription}
            onChange={setAllowWithoutSubscription}
          />
          <SettingsToggleRow
            id="absentConsumesSession"
            label="Une absence consomme une séance"
            description="Lorsqu'elle est activée, une absence déduit une séance du quota restant."
            checked={absentConsumesSession}
            onChange={setAbsentConsumesSession}
          />
        </div>
      </FormSection>

      <ClubPlanningRulesSection
        workingDays={workingDays}
        allowSameRoomConcurrentGroups={allowSameRoomConcurrentGroups}
        allowCoachConcurrentSameRoomQualified={allowCoachConcurrentSameRoomQualified}
        onToggleWorkingDay={toggleWorkingDay}
        onAllowSameRoomConcurrentGroupsChange={setAllowSameRoomConcurrentGroups}
        onAllowCoachConcurrentSameRoomQualifiedChange={setAllowCoachConcurrentSameRoomQualified}
      />

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
            <FieldControl suffix={MONEY_INPUT_SUFFIX}>
              <input
                id="debtThreshold"
                type="text"
                inputMode="decimal"
                className="field pr-10"
                value={debtThresholdAmount}
                onChange={(e) => setDebtThresholdAmount(e.target.value)}
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

      <FormSection
        id="club-receipts"
        title="Recus de paiement"
        description="Configurez la numerotation et le texte affiche sur les recus imprimes ou verifies en ligne."
      >
        <ClubReceiptSettings
          clubName={clubName}
          receiptLegalName={receiptLegalName}
          receiptTaxId={receiptTaxId}
          receiptPrefix={receiptPrefix}
          nextReceiptSequence={nextReceiptSequence}
          receiptFooter={receiptFooter}
          receiptEmailDefault={receiptEmailDefault}
          receiptPrintDefault={receiptPrintDefault}
          onReceiptPrefixChange={setReceiptPrefix}
          onNextReceiptSequenceChange={setNextReceiptSequence}
          onReceiptFooterChange={setReceiptFooter}
          onReceiptLegalNameChange={setReceiptLegalName}
          onReceiptTaxIdChange={setReceiptTaxId}
          onReceiptEmailDefaultChange={setReceiptEmailDefault}
          onReceiptPrintDefaultChange={setReceiptPrintDefault}
        />
      </FormSection>

      <FormActions sticky>
        <button type="submit" className="btn btn-primary btn-block-mobile" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
      </FormActions>
    </form>
  );
}
