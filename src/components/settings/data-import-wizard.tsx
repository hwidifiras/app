"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DataImportAttendanceSection,
  type DataImportAttendanceChoice,
} from "@/components/settings/data-import-attendance-section";
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
  type SessionOption,
} from "./data-import-model";

export function DataImportWizard({
  groups,
  plans,
  sessions,
}: {
  groups: GroupOption[];
  plans: PlanOption[];
  sessions: SessionOption[];
}) {
  const router = useRouter();
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
    joinedAt: DATA_IMPORT_TODAY,
  });
  const [groupId, setGroupId] = useState("");
  const [planId, setPlanId] = useState("");
  const [cutoverDate, setCutoverDate] = useState(DATA_IMPORT_TODAY);
  const [assignmentStartDate, setAssignmentStartDate] = useState(DATA_IMPORT_TODAY);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(DATA_IMPORT_TODAY);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [remainingSessions, setRemainingSessions] = useState("");
  const [paymentDate, setPaymentDate] = useState(DATA_IMPORT_TODAY);
  const [paymentMethod, setPaymentMethod] = useState("REPRISE_PAPIER");
  const [note, setNote] = useState("Import ancien fichier depuis le registre papier");
  const [attendanceStatuses, setAttendanceStatuses] = useState<
    Record<string, "PRESENT" | "ABSENT">
  >({});

  const selectedGroup = groups.find((group) => group.id === groupId);
  const compatiblePlans = selectedGroup
    ? plans.filter((plan) => plan.sportId === selectedGroup.sportId)
    : [];
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const eligibleSessions = sessions.filter((session) => session.groupId === groupId);

  const expiresLabel = status.expiresAt
    ? new Date(status.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const payload = useMemo(
    () => ({
      cutoverDate: isoDate(cutoverDate),
      member: {
        ...member,
        joinedAt: isoDate(member.joinedAt),
        birthDate: member.birthDate ? isoDate(member.birthDate) : "",
      },
      groupId,
      planId,
      assignmentStartDate: isoDate(assignmentStartDate),
      subscriptionStartDate: isoDate(subscriptionStartDate),
      subscriptionEndDate: subscriptionEndDate ? isoDate(subscriptionEndDate) : "",
      amountCents: moneyInputToCents(amount),
      paidCents: moneyInputToCents(paid),
      remainingSessions: Math.max(0, Math.round(Number(remainingSessions) || 0)),
      paymentDate: paymentDate ? isoDate(paymentDate) : "",
      paymentMethod,
      note,
      attendances: Object.entries(attendanceStatuses).map(([sessionId, attendanceStatus]) => ({
        sessionId,
        status: attendanceStatus,
      })),
    }),
    [
      amount,
      assignmentStartDate,
      attendanceStatuses,
      cutoverDate,
      groupId,
      member,
      note,
      paid,
      paymentDate,
      paymentMethod,
      planId,
      remainingSessions,
      subscriptionEndDate,
      subscriptionStartDate,
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

  function updateMember<K extends keyof typeof member>(key: K, value: (typeof member)[K]) {
    setMember((current) => ({ ...current, [key]: value }));
    invalidatePreview();
  }

  function selectGroup(nextGroupId: string) {
    setGroupId(nextGroupId);
    setPlanId("");
    setAttendanceStatuses({});
    invalidatePreview();
  }

  function selectPlan(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = plans.find((item) => item.id === nextPlanId);
    if (plan) {
      setAmount((plan.price / 100).toFixed(2));
      setRemainingSessions(String(plan.totalSessions));
      const start = new Date(`${subscriptionStartDate}T00:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() + plan.validityDays);
      setSubscriptionEndDate(start.toISOString().slice(0, 10));
    }
    invalidatePreview();
  }

  function updateAttendanceStatus(sessionId: string, choice: DataImportAttendanceChoice) {
    setAttendanceStatuses((current) => {
      const next = { ...current };
      if (choice === "NONE") delete next[sessionId];
      else next[sessionId] = choice;
      return next;
    });
    invalidatePreview();
  }

  function updateCurrentStateField(field: DataImportCurrentStateField, value: string) {
    const setters: Record<DataImportCurrentStateField, (nextValue: string) => void> = {
      cutoverDate: setCutoverDate,
      groupId: setGroupId,
      planId: setPlanId,
      assignmentStartDate: setAssignmentStartDate,
      subscriptionStartDate: setSubscriptionStartDate,
      subscriptionEndDate: setSubscriptionEndDate,
      remainingSessions: setRemainingSessions,
      amount: setAmount,
      paid: setPaid,
      paymentDate: setPaymentDate,
      paymentMethod: setPaymentMethod,
      note: setNote,
    };

    setters[field](value);
    invalidatePreview();
  }

  async function modeAction(action: "activate" | "deactivate") {
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
              { href: "#reprise-current", label: "État réel" },
              { href: "#reprise-attendance", label: "Pointages" },
            ]}
          />

          <DataImportMemberSection
            member={member}
            cutoverDate={cutoverDate}
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
              assignmentStartDate,
              subscriptionStartDate,
              subscriptionEndDate,
              remainingSessions,
              amount,
              paid,
              paymentDate,
              paymentMethod,
              note,
            }}
            onFieldChange={updateCurrentStateField}
            onGroupChange={selectGroup}
            onPlanChange={selectPlan}
          />

          <DataImportAttendanceSection
            eligibleSessions={eligibleSessions}
            attendanceStatuses={attendanceStatuses}
            onStatusChange={updateAttendanceStatus}
          />

          <DataImportPreviewSummary preview={preview} />

          <FormActions sticky className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="submit" disabled={busy} className="btn btn-ghost btn-block-mobile">
              Vérifier toutes les contraintes
            </button>
            <button type="button" disabled={busy || !preview} onClick={() => void submit("apply")} className="btn btn-primary btn-block-mobile">
              <Upload className="size-4" /> Appliquer l&apos;import
            </button>
          </FormActions>
        </form>
        </>
      ) : null}

      <RecentImportsPanel status={status} busy={busy} onRollback={(auditLogId) => void rollback(auditLogId)} />
    </div>
  );
}
