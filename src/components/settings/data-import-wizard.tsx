"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataImportBulkSection } from "@/components/settings/data-import-bulk-section";
import {
  DataImportCurrentStateSection,
  type DataImportCurrentStateField,
} from "@/components/settings/data-import-current-state-section";
import {
  DataImportMemberSection,
  type DataImportMemberDraft,
} from "@/components/settings/data-import-member-section";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormSectionNav } from "@/components/ui/form-layout";
import {
  DEMO_READ_ONLY_MESSAGE,
  DemoMutationButton,
  useDemoReadOnly,
} from "@/components/ui/demo-read-only";
import type { BulkImportResult } from "@/components/settings/data-import-bulk-ui";
import { DataImportPreviewSummary } from "@/components/settings/data-import-preview-summary";
import {
  DataImportModePanel,
  RecentImportsPanel,
  type ImportStatus,
} from "@/components/settings/data-import-status-ui";
import {
  DATA_IMPORT_TEMPLATE_URL,
  DATA_IMPORT_TODAY,
  isoDate,
  moneyInputToCents,
  type DataImportPreview,
  type GroupOption,
  type PlanOption,
} from "./data-import-model";

export function DataImportWizard({
  groups,
  plans,
}: {
  groups: GroupOption[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const demoReadOnly = useDemoReadOnly();
  const [status, setStatus] = useState<ImportStatus>({
    active: false,
    expiresAt: null,
    recentImports: [],
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<DataImportPreview | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkImportResult | null>(null);

  const [member, setMember] = useState<DataImportMemberDraft>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    memberType: "ADULT" as "ADULT" | "KID" | "NOT_SPECIFIED",
    gender: "NOT_SPECIFIED" as "MALE" | "FEMALE" | "NOT_SPECIFIED",
    birthDate: "",
    address: "",
    parentName: "",
    parentPhone: "",
  });
  const [groupId, setGroupId] = useState("");
  const [planId, setPlanId] = useState("");
  const [cutoverDate, setCutoverDate] = useState(DATA_IMPORT_TODAY);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [remainingSessions, setRemainingSessions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("REPRISE_PAPIER");
  const [note, setNote] = useState("Reprise simple des anciens membres");

  const selectedGroup = groups.find((group) => group.id === groupId);
  const compatiblePlans = selectedGroup
    ? plans.filter((plan) => plan.sportId === selectedGroup.sportId)
    : [];
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const expiresLabel = status.expiresAt
    ? new Date(status.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const payload = useMemo(
    () => ({
      cutoverDate: isoDate(cutoverDate),
      member: {
        ...member,
        joinedAt: isoDate(cutoverDate),
        birthDate: member.birthDate ? isoDate(member.birthDate) : "",
      },
      groupId,
      planId,
      assignmentStartDate: isoDate(cutoverDate),
      subscriptionStartDate: isoDate(cutoverDate),
      subscriptionEndDate: subscriptionEndDate ? isoDate(subscriptionEndDate) : "",
      amountCents: moneyInputToCents(amount),
      paidCents: moneyInputToCents(paid),
      remainingSessions: Math.max(0, Math.round(Number(remainingSessions) || 0)),
      paymentDate: moneyInputToCents(paid) > 0 ? isoDate(cutoverDate) : "",
      paymentMethod,
      note,
      attendances: [],
    }),
    [
      amount,
      cutoverDate,
      groupId,
      member,
      note,
      paid,
      paymentMethod,
      planId,
      remainingSessions,
      subscriptionEndDate,
    ],
  );

  async function loadStatus() {
    const response = await fetch("/api/data-import", { cache: "no-store" });
    const json = (await response.json()) as { data?: ImportStatus; error?: string };
    if (response.ok && json.data) {
      setStatus(json.data);
    } else {
      setMessage(json.error ?? "Impossible de charger l'import ancien fichier.");
    }
    setLoadingStatus(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function invalidatePreview() {
    setPreview(null);
    setMessage(null);
  }

  function blockDemoMutation() {
    if (!demoReadOnly) return false;
    setMessage(DEMO_READ_ONLY_MESSAGE);
    return true;
  }

  function updateMember<K extends keyof typeof member>(key: K, value: (typeof member)[K]) {
    setMember((current) => ({ ...current, [key]: value }));
    invalidatePreview();
  }

  function selectGroup(nextGroupId: string) {
    setGroupId(nextGroupId);
    setPlanId("");
    invalidatePreview();
  }

  function selectPlan(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = plans.find((item) => item.id === nextPlanId);
    if (plan) {
      setAmount((plan.price / 100).toFixed(2));
      setRemainingSessions(String(plan.totalSessions));
      const start = new Date(`${cutoverDate}T00:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() + plan.validityDays);
      setSubscriptionEndDate(start.toISOString().slice(0, 10));
    }
    invalidatePreview();
  }

  function updateCurrentStateField(field: DataImportCurrentStateField, value: string) {
    const setters: Record<DataImportCurrentStateField, (nextValue: string) => void> = {
      cutoverDate: setCutoverDate,
      groupId: setGroupId,
      planId: setPlanId,
      subscriptionEndDate: setSubscriptionEndDate,
      remainingSessions: setRemainingSessions,
      amount: setAmount,
      paid: setPaid,
      paymentMethod: setPaymentMethod,
      note: setNote,
    };

    setters[field](value);
    invalidatePreview();
  }

  async function modeAction(action: "activate" | "deactivate") {
    if (blockDemoMutation()) return;

    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/data-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = (await response.json()) as {
      data?: { active: boolean; expiresAt: string | null };
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !json.data) {
      setMessage(json.error ?? "Action impossible.");
      return;
    }
    setStatus((current) => ({ ...current, ...json.data }));
    setPreview(null);
    setMessage(action === "activate" ? "Import ancien fichier ouvert." : "Import ancien fichier fermé.");
  }

  async function submit(action: "preview" | "apply") {
    // Preview is also a POST request and the demo proxy rejects every unsafe
    // data-import request. Guard it here so keyboard or programmatic submits
    // stay truthful instead of surfacing an avoidable 403.
    if (blockDemoMutation()) return;

    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/data-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const json = (await response.json()) as { data?: DataImportPreview | { memberId: string }; error?: string };
    setBusy(false);
    if (!response.ok || !json.data) {
      setPreview(null);
      setMessage(json.error ?? "L'import ancien fichier n'a pas pu être validé.");
      return;
    }
    if (action === "preview") {
      setPreview(json.data as DataImportPreview);
      setMessage("Prévalidation réussie. Vérifiez le résumé avant d'appliquer.");
      return;
    }

    const result = json.data as { memberId: string };
    setMessage("Membre repris avec succès.");
    setPreview(null);
    await loadStatus();
    router.push(`/members/${result.memberId}`);
    router.refresh();
  }

  async function rollback(auditLogId: string) {
    if (blockDemoMutation()) return;
    if (!window.confirm("Annuler entièrement cet import ?")) return;
    setBusy(true);
    const response = await fetch("/api/data-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rollback", auditLogId }),
    });
    const json = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(json.error ?? "Annulation impossible.");
      return;
    }
    setMessage("Import annulé.");
    await loadStatus();
    router.refresh();
  }

  async function submitBulk(action: "preview" | "apply") {
    if (blockDemoMutation()) return;

    if (!bulkFile) {
      setMessage("Choisissez le fichier Excel d'import.");
      return;
    }

    setBulkBusy(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("action", action);
    formData.append("cutoverDate", cutoverDate);
    formData.append("file", bulkFile);

    const response = await fetch("/api/data-import/bulk", {
      method: "POST",
      body: formData,
    });
    const json = (await response.json()) as { data?: BulkImportResult; error?: string };
    setBulkBusy(false);

    if (!response.ok || !json.data) {
      setBulkPreview(null);
      setMessage(json.error ?? "Import Excel impossible.");
      return;
    }

    setBulkPreview(json.data);
    if (action === "preview") {
      setMessage(
        json.data.errorRows > 0
          ? `${json.data.errorRows} ligne(s) a corriger avant import.`
          : "Prevalidation Excel reussie. Vous pouvez appliquer l'import.",
      );
      return;
    }

    setMessage(`${json.data.importedRows} membre(s) importe(s) avec succes.`);
    await loadStatus();
    router.refresh();
  }

  if (loadingStatus) {
    return <section className="panel p-5 text-sm text-[var(--muted-foreground)]">Chargement de l&apos;import ancien fichier…</section>;
  }

  return (
    <div className="space-y-5">
      <DataImportModePanel
        status={status}
        expiresLabel={expiresLabel}
        busy={busy}
        templateUrl={DATA_IMPORT_TEMPLATE_URL}
        onToggleMode={() => void modeAction(status.active ? "deactivate" : "activate")}
      />

      <FeedbackMessage
        message={message}
        variant={
          message?.includes("réuss") ||
          message?.includes("ouvert") ||
          message?.includes("fermé") ||
          message?.includes("annulé")
            ? "success"
            : undefined
        }
      />

      {status.active ? (
        <>
          <DataImportBulkSection
            templateUrl={DATA_IMPORT_TEMPLATE_URL}
            bulkBusy={bulkBusy}
            bulkFile={bulkFile}
            bulkPreview={bulkPreview}
            onFileChange={(file) => {
              setBulkFile(file);
              setBulkPreview(null);
              setMessage(null);
            }}
            onPreview={() => void submitBulk("preview")}
            onApply={() => void submitBulk("apply")}
          />

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("preview");
          }}
        >
          <FormSectionNav
            items={[
              { href: "#reprise-identity", label: "Identité" },
              { href: "#reprise-current", label: "État initial" },
            ]}
          />

          <DataImportMemberSection
            member={member}
            onMemberChange={updateMember}
          />

          <DataImportCurrentStateSection
            groups={groups}
            compatiblePlans={compatiblePlans}
            selectedPlan={selectedPlan}
            values={{
              cutoverDate,
              groupId,
              planId,
              subscriptionEndDate,
              remainingSessions,
              amount,
              paid,
              paymentMethod,
              note,
            }}
            onFieldChange={updateCurrentStateField}
            onGroupChange={selectGroup}
            onPlanChange={selectPlan}
          />

          <DataImportPreviewSummary preview={preview} />

          <FormActions sticky className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="submit" disabled={busy} className="btn btn-ghost btn-block-mobile">
              Vérifier toutes les contraintes
            </button>
            <DemoMutationButton type="button" disabled={busy || !preview} onClick={() => void submit("apply")} className="btn btn-primary btn-block-mobile">
              <Upload className="size-4" /> Appliquer l&apos;import
            </DemoMutationButton>
          </FormActions>
        </form>
        </>
      ) : null}

      <RecentImportsPanel status={status} busy={busy} onRollback={(auditLogId) => void rollback(auditLogId)} />
    </div>
  );
}
