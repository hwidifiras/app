"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClubAlertsSection } from "@/components/settings/club-alerts-section";
import { ClubCheckinRulesSection } from "@/components/settings/club-checkin-rules-section";
import { ClubDashboardSection } from "@/components/settings/club-dashboard-section";
import { ClubIdentitySection } from "@/components/settings/club-identity-section";
import { ClubGymRulesSection } from "@/components/settings/club-gym-rules-section";
import { ClubPlanningRulesSection } from "@/components/settings/club-planning-rules-section";
import { ClubReceiptSettings } from "@/components/settings/club-receipt-settings";
import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormSection, FormSectionNav } from "@/components/ui/form-layout";
import {
  DEFAULT_WORKING_DAYS,
  WORKING_DAY_ORDER,
  type ClubDay,
} from "@/lib/club-working-days";
import { normalizeDashboardDefaultMode, type DashboardDefaultMode } from "@/lib/dashboard-preferences";

export type ClubSettingsFormData = {
  clubName: string;
  clubLogoUrl: string;
  clubAddress: string;
  clubPhone: string;
  receiptLegalName: string;
  receiptTaxId: string;
  allowPublicRegister: boolean;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  absentConsumesSession: boolean;
  allowSameRoomConcurrentGroups: boolean;
  allowCoachConcurrentSameRoomQualified: boolean;
  workingDays: ClubDay[];
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
  dashboardDefaultMode: DashboardDefaultMode;
  dashboardShowTodaySessions: boolean;
  dashboardShowCashToday: boolean;
  dashboardShowDataConfidence: boolean;
  dashboardShowCashTrend: boolean;
  dashboardShowMembersOverview: boolean;
  dashboardShowCommercialInsights: boolean;
  dashboardShowDetailedDebts: boolean;
  dashboardShowGymOverview: boolean;
  gymAllowCheckInWithPartialPayment: boolean;
  gymDuplicateScanWindowMinutes: number;
  gymDailyVisitLimit: number | null;
  gymAllowExceptionalAccess: boolean;
  receiptPrefix: string;
  nextReceiptSequence: number;
  receiptFooter: string;
  receiptEmailDefault: boolean;
  receiptPrintDefault: boolean;
};

type ClubSettingsFormProps = {
  initial: ClubSettingsFormData;
  gymModuleEnabled?: boolean;
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

export function ClubSettingsForm({ initial, gymModuleEnabled = false }: ClubSettingsFormProps) {
  const router = useRouter();
  const [clubName, setClubName] = useState(initial.clubName);
  const [clubLogoUrl, setClubLogoUrl] = useState(initial.clubLogoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [clubAddress, setClubAddress] = useState(initial.clubAddress);
  const [clubPhone, setClubPhone] = useState(initial.clubPhone);
  const [receiptLegalName, setReceiptLegalName] = useState(initial.receiptLegalName);
  const [receiptTaxId, setReceiptTaxId] = useState(initial.receiptTaxId);
  const [allowPublicRegister, setAllowPublicRegister] = useState(initial.allowPublicRegister);
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
  const [dashboardDefaultMode, setDashboardDefaultMode] = useState(
    normalizeDashboardDefaultMode(initial.dashboardDefaultMode),
  );
  const [dashboardShowTodaySessions, setDashboardShowTodaySessions] = useState(initial.dashboardShowTodaySessions);
  const [dashboardShowCashToday, setDashboardShowCashToday] = useState(initial.dashboardShowCashToday);
  const [dashboardShowDataConfidence, setDashboardShowDataConfidence] = useState(initial.dashboardShowDataConfidence);
  const [dashboardShowCashTrend, setDashboardShowCashTrend] = useState(initial.dashboardShowCashTrend);
  const [dashboardShowMembersOverview, setDashboardShowMembersOverview] = useState(initial.dashboardShowMembersOverview);
  const [dashboardShowCommercialInsights, setDashboardShowCommercialInsights] = useState(
    initial.dashboardShowCommercialInsights,
  );
  const [dashboardShowDetailedDebts, setDashboardShowDetailedDebts] = useState(initial.dashboardShowDetailedDebts);
  const [dashboardShowGymOverview, setDashboardShowGymOverview] = useState(initial.dashboardShowGymOverview);
  const [gymAllowPartialPayment, setGymAllowPartialPayment] = useState(initial.gymAllowCheckInWithPartialPayment);
  const [gymDuplicateWindow, setGymDuplicateWindow] = useState(String(initial.gymDuplicateScanWindowMinutes));
  const [gymDailyLimit, setGymDailyLimit] = useState(initial.gymDailyVisitLimit ? String(initial.gymDailyVisitLimit) : "");
  const [gymAllowExceptionalAccess, setGymAllowExceptionalAccess] = useState(initial.gymAllowExceptionalAccess);
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
        allowPublicRegister,
        allowCheckInWithPartialPayment: allowPartialPayment,
        allowCheckInWithoutSubscription: allowWithoutSubscription,
        absentConsumesSession,
        allowSameRoomConcurrentGroups,
        allowCoachConcurrentSameRoomQualified,
        workingDays,
        maxStaffDiscountPercent: discount,
        debtAlertThresholdCents,
        dashboardDefaultMode,
        dashboardShowTodaySessions,
        dashboardShowCashToday,
        dashboardShowDataConfidence,
        dashboardShowCashTrend,
        dashboardShowMembersOverview,
        dashboardShowCommercialInsights,
        dashboardShowDetailedDebts,
        dashboardShowGymOverview,
        gymAllowCheckInWithPartialPayment: gymAllowPartialPayment,
        gymDuplicateScanWindowMinutes: Math.max(0, Number.parseInt(gymDuplicateWindow, 10) || 0),
        gymDailyVisitLimit: gymDailyLimit.trim() ? Math.max(1, Number.parseInt(gymDailyLimit, 10) || 1) : null,
        gymAllowExceptionalAccess,
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
    setAllowPublicRegister(Boolean(json.data.allowPublicRegister));
    setAllowPartialPayment(json.data.allowCheckInWithPartialPayment);
    setAllowWithoutSubscription(json.data.allowCheckInWithoutSubscription);
    setAbsentConsumesSession(json.data.absentConsumesSession);
    setAllowSameRoomConcurrentGroups(json.data.allowSameRoomConcurrentGroups);
    setAllowCoachConcurrentSameRoomQualified(json.data.allowCoachConcurrentSameRoomQualified);
    setWorkingDays(json.data.workingDays?.length ? json.data.workingDays : [...DEFAULT_WORKING_DAYS]);
    setMaxStaffDiscountPercent(String(json.data.maxStaffDiscountPercent));
    setDebtThresholdAmount(centsToMoneyInput(json.data.debtAlertThresholdCents));
    setDashboardDefaultMode(normalizeDashboardDefaultMode(json.data.dashboardDefaultMode));
    setDashboardShowTodaySessions(json.data.dashboardShowTodaySessions !== false);
    setDashboardShowCashToday(json.data.dashboardShowCashToday !== false);
    setDashboardShowDataConfidence(json.data.dashboardShowDataConfidence !== false);
    setDashboardShowCashTrend(json.data.dashboardShowCashTrend !== false);
    setDashboardShowMembersOverview(json.data.dashboardShowMembersOverview !== false);
    setDashboardShowCommercialInsights(json.data.dashboardShowCommercialInsights !== false);
    setDashboardShowDetailedDebts(json.data.dashboardShowDetailedDebts !== false);
    setDashboardShowGymOverview(json.data.dashboardShowGymOverview !== false);
    setGymAllowPartialPayment(json.data.gymAllowCheckInWithPartialPayment !== false);
    setGymDuplicateWindow(String(json.data.gymDuplicateScanWindowMinutes ?? 2));
    setGymDailyLimit(json.data.gymDailyVisitLimit ? String(json.data.gymDailyVisitLimit) : "");
    setGymAllowExceptionalAccess(json.data.gymAllowExceptionalAccess !== false);
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
          { href: "#club-access", label: "Accès" },
          { href: "#club-checkin", label: "Pointage" },
          ...(gymModuleEnabled ? [{ href: "#club-gym", label: "Salle" }] : []),
          { href: "#club-planning", label: "Planning" },
          { href: "#club-alerts", label: "Alertes" },
          { href: "#club-dashboard", label: "Dashboard" },
          { href: "#club-receipts", label: "Reçus" },
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
        id="club-access"
        title="Accès au club"
        description="Contrôlez les demandes de comptes avant qu'elles n'atteignent votre équipe."
      >
        <SettingsToggleRow
          id="allowPublicRegister"
          label="Autoriser les demandes d'accès publiques"
          description="Les nouveaux comptes restent inactifs, sans permission, jusqu'à l'approbation explicite d'un administrateur. Le coupe-circuit global de la plateforme reste prioritaire."
          checked={allowPublicRegister}
          onChange={setAllowPublicRegister}
        />
      </FormSection>

      <ClubCheckinRulesSection
        allowPartialPayment={allowPartialPayment}
        allowWithoutSubscription={allowWithoutSubscription}
        absentConsumesSession={absentConsumesSession}
        onAllowPartialPaymentChange={setAllowPartialPayment}
        onAllowWithoutSubscriptionChange={setAllowWithoutSubscription}
        onAbsentConsumesSessionChange={setAbsentConsumesSession}
      />

      {gymModuleEnabled ? (
        <ClubGymRulesSection
          allowPartialPayment={gymAllowPartialPayment}
          allowExceptionalAccess={gymAllowExceptionalAccess}
          duplicateWindowMinutes={gymDuplicateWindow}
          dailyVisitLimit={gymDailyLimit}
          showDashboardWidget={dashboardShowGymOverview}
          onAllowPartialPaymentChange={setGymAllowPartialPayment}
          onAllowExceptionalAccessChange={setGymAllowExceptionalAccess}
          onDuplicateWindowMinutesChange={setGymDuplicateWindow}
          onDailyVisitLimitChange={setGymDailyLimit}
          onShowDashboardWidgetChange={setDashboardShowGymOverview}
        />
      ) : null}

      <ClubPlanningRulesSection
        workingDays={workingDays}
        allowSameRoomConcurrentGroups={allowSameRoomConcurrentGroups}
        allowCoachConcurrentSameRoomQualified={allowCoachConcurrentSameRoomQualified}
        onToggleWorkingDay={toggleWorkingDay}
        onAllowSameRoomConcurrentGroupsChange={setAllowSameRoomConcurrentGroups}
        onAllowCoachConcurrentSameRoomQualifiedChange={setAllowCoachConcurrentSameRoomQualified}
      />

      <ClubAlertsSection
        debtThresholdAmount={debtThresholdAmount}
        maxStaffDiscountPercent={maxStaffDiscountPercent}
        onDebtThresholdAmountChange={setDebtThresholdAmount}
        onMaxStaffDiscountPercentChange={setMaxStaffDiscountPercent}
      />

      <ClubDashboardSection
        dashboardDefaultMode={dashboardDefaultMode}
        dashboardShowTodaySessions={dashboardShowTodaySessions}
        dashboardShowCashToday={dashboardShowCashToday}
        dashboardShowDataConfidence={dashboardShowDataConfidence}
        dashboardShowCashTrend={dashboardShowCashTrend}
        dashboardShowMembersOverview={dashboardShowMembersOverview}
        dashboardShowCommercialInsights={dashboardShowCommercialInsights}
        dashboardShowDetailedDebts={dashboardShowDetailedDebts}
        onDashboardDefaultModeChange={setDashboardDefaultMode}
        onDashboardShowTodaySessionsChange={setDashboardShowTodaySessions}
        onDashboardShowCashTodayChange={setDashboardShowCashToday}
        onDashboardShowDataConfidenceChange={setDashboardShowDataConfidence}
        onDashboardShowCashTrendChange={setDashboardShowCashTrend}
        onDashboardShowMembersOverviewChange={setDashboardShowMembersOverview}
        onDashboardShowCommercialInsightsChange={setDashboardShowCommercialInsights}
        onDashboardShowDetailedDebtsChange={setDashboardShowDetailedDebts}
      />
      <FormSection
        id="club-receipts"
        title="Reçus"
        description="Choisissez ce qui se passe après un encaissement et gardez les options avancées à part."
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
