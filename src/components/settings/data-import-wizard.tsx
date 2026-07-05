"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormSectionNav } from "@/components/ui/form-layout";
import {
  BulkImportPreviewTable,
  type BulkImportResult,
} from "@/components/settings/data-import-bulk-ui";
import {
  DataImportModePanel,
  RecentImportsPanel,
  type ImportStatus,
} from "@/components/settings/data-import-status-ui";
import type { GroupTypeValue } from "@/lib/demographics";
import { formatMoney } from "@/lib/money";

type GroupOption = {
  id: string;
  name: string;
  groupType: GroupTypeValue;
  sportId: string;
  sportName: string;
};

type PlanOption = {
  id: string;
  name: string;
  sportId: string;
  price: number;
  totalSessions: number;
  validityDays: number;
};

type SessionOption = {
  id: string;
  groupId: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
};

type Preview = {
  memberPhone: string;
  memberName: string;
  groupName: string;
  planName: string;
  sportName: string;
  remainingBalanceCents: number;
  attendanceCount: number;
  warnings: string[];
};

const today = new Date().toISOString().slice(0, 10);
const templateUrl = "/templates/we-discipline-reprise-membres.xlsx";

function isoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function moneyInputToCents(value: string) {
  return Math.round((Number.parseFloat(value.replace(",", ".")) || 0) * 100);
}

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
  const [preview, setPreview] = useState<Preview | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkImportResult | null>(null);

  const [member, setMember] = useState({
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
    joinedAt: today,
  });
  const [groupId, setGroupId] = useState("");
  const [planId, setPlanId] = useState("");
  const [cutoverDate, setCutoverDate] = useState(today);
  const [assignmentStartDate, setAssignmentStartDate] = useState(today);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(today);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [remainingSessions, setRemainingSessions] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
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
    const json = (await response.json()) as { data?: Preview | { memberId: string }; error?: string };
    setBusy(false);
    if (!response.ok || !json.data) {
      setPreview(null);
      setMessage(json.error ?? "L'import ancien fichier n'a pas pu être validé.");
      return;
    }
    if (action === "preview") {
      setPreview(json.data as Preview);
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
        templateUrl={templateUrl}
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
          <section className="panel p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">Import Excel</p>
                <h2 className="mt-1 text-lg font-semibold">Import en masse</h2>
                <p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">
                  Utilisez le modèle, gardez les noms de groupes/formules tels qu&apos;ils existent dans le club, puis lancez la prévalidation avant d&apos;importer.
                </p>
                <p className="mt-2 max-w-3xl rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                  Aucun code membre à inventer : le modèle commence par Prénom et l&apos;application génère une référence pendant Vérifier Excel.
                </p>
              </div>
              <a href={templateUrl} className="btn btn-ghost btn-block-mobile" download>
                Télécharger le modèle
              </a>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <label className="text-sm font-medium">
                Fichier .xlsx ou .csv
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="field mt-1"
                  onChange={(event) => {
                    setBulkFile(event.target.files?.[0] ?? null);
                    setBulkPreview(null);
                    setMessage(null);
                  }}
                />
              </label>
              <button type="button" disabled={bulkBusy || !bulkFile} onClick={() => void submitBulk("preview")} className="btn btn-ghost btn-block-mobile">
                Vérifier Excel
              </button>
              <button
                type="button"
                disabled={bulkBusy || !bulkPreview || bulkPreview.errorRows > 0 || bulkPreview.okRows === 0}
                onClick={() => void submitBulk("apply")}
                className="btn btn-primary btn-block-mobile"
              >
                <Upload className="size-4" /> Importer {bulkPreview?.okRows ? `(${bulkPreview.okRows})` : ""}
              </button>
            </div>

            {bulkPreview ? <BulkImportPreviewTable result={bulkPreview} /> : null}
          </section>

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

          <section id="reprise-identity" className="form-section-anchor panel p-4 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">1. Identité</p>
              <h2 className="mt-1 text-lg font-semibold">Membre à importer</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium">Prénom *
                <input className="field mt-1" value={member.firstName} onChange={(event) => updateMember("firstName", event.target.value)} required />
              </label>
              <label className="text-sm font-medium">Nom *
                <input className="field mt-1" value={member.lastName} onChange={(event) => updateMember("lastName", event.target.value)} required />
              </label>
              <label className="text-sm font-medium">Type *
                <select className="field mt-1" value={member.memberType} onChange={(event) => updateMember("memberType", event.target.value as typeof member.memberType)}>
                  <option value="ADULT">Adulte</option>
                  <option value="KID">Enfant</option>
                  <option value="NOT_SPECIFIED">Non précisé</option>
                </select>
              </label>
              <label className="text-sm font-medium">Genre *
                <select className="field mt-1" value={member.gender} onChange={(event) => updateMember("gender", event.target.value as typeof member.gender)} required>
                  <option value="NOT_SPECIFIED">Non précisé</option>
                  <option value="MALE">Garçon / homme</option>
                  <option value="FEMALE">Fille / femme</option>
                </select>
              </label>
              <label className="text-sm font-medium">Téléphone
                <input className="field mt-1" value={member.phone} onChange={(event) => updateMember("phone", event.target.value)} />
              </label>
              <label className="text-sm font-medium">Email
                <input type="email" className="field mt-1" value={member.email} onChange={(event) => updateMember("email", event.target.value)} />
              </label>
              <label className="text-sm font-medium">Inscrit au club depuis *
                <input type="date" className="field mt-1" value={member.joinedAt} max={cutoverDate} onChange={(event) => updateMember("joinedAt", event.target.value)} required />
              </label>
              {member.memberType === "KID" ? (
                <>
                  <label className="text-sm font-medium">Nom du parent
                    <input className="field mt-1" value={member.parentName} onChange={(event) => updateMember("parentName", event.target.value)} />
                  </label>
                  <label className="text-sm font-medium">Téléphone du parent *
                    <input className="field mt-1" value={member.parentPhone} onChange={(event) => updateMember("parentPhone", event.target.value)} required />
                  </label>
                </>
              ) : null}
            </div>
          </section>

          <section id="reprise-current" className="form-section-anchor panel p-4 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">2. État réel</p>
              <h2 className="mt-1 text-lg font-semibold">Affectation et abonnement en cours</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium">Date de bascule *
                <input type="date" className="field mt-1" value={cutoverDate} max={today} onChange={(event) => { setCutoverDate(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Groupe *
                <select className="field mt-1" value={groupId} onChange={(event) => selectGroup(event.target.value)} required>
                  <option value="">Sélectionner</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.sportName}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Formule compatible *
                <select className="field mt-1" value={planId} onChange={(event) => selectPlan(event.target.value)} disabled={!groupId} required>
                  <option value="">Sélectionner</option>
                  {compatiblePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.totalSessions} séances</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Affecté au groupe depuis *
                <input type="date" className="field mt-1" value={assignmentStartDate} max={cutoverDate} onChange={(event) => { setAssignmentStartDate(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Début abonnement *
                <input type="date" className="field mt-1" value={subscriptionStartDate} max={cutoverDate} onChange={(event) => { setSubscriptionStartDate(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Fin abonnement *
                <input type="date" className="field mt-1" value={subscriptionEndDate} min={cutoverDate} onChange={(event) => { setSubscriptionEndDate(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Séances restantes *
                <input type="number" min="1" max={selectedPlan?.totalSessions} className="field mt-1" value={remainingSessions} onChange={(event) => { setRemainingSessions(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Montant total dû (TND) *
                <input type="number" min="0" step="0.01" className="field mt-1" value={amount} onChange={(event) => { setAmount(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Déjà payé (TND) *
                <input type="number" min="0" step="0.01" className="field mt-1" value={paid} onChange={(event) => { setPaid(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Date du solde repris
                <input type="date" className="field mt-1" value={paymentDate} max={cutoverDate} onChange={(event) => { setPaymentDate(event.target.value); invalidatePreview(); }} />
              </label>
              <label className="text-sm font-medium">Origine du règlement
                <select className="field mt-1" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); invalidatePreview(); }}>
                  <option value="REPRISE_PAPIER">Ancien registre papier</option>
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte</option>
                  <option value="TRANSFER">Virement</option>
                  <option value="CHECK">Chèque</option>
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">Note d&apos;import *
                <input className="field mt-1" value={note} onChange={(event) => { setNote(event.target.value); invalidatePreview(); }} required />
              </label>
            </div>
          </section>

          <section id="reprise-attendance" className="form-section-anchor panel p-4 sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">3. Semaine de bascule</p>
              <h2 className="mt-1 text-lg font-semibold">Pointages déjà réalisés sur papier</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Sélectionnez uniquement les séances antérieures à la bascule. Elles servent au quota hebdomadaire sans retirer une seconde fois les séances restantes.
              </p>
            </div>
            {eligibleSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
                Aucune séance passée disponible cette semaine pour ce groupe.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {eligibleSessions.map((session) => {
                  const selected = attendanceStatuses[session.id];
                  return (
                    <div key={session.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                      <p className="text-sm font-semibold">{new Date(session.sessionDate).toLocaleDateString("fr-FR")} · {session.startTime}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {(["PRESENT", "ABSENT", "NONE"] as const).map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => {
                              setAttendanceStatuses((current) => {
                                const next = { ...current };
                                if (choice === "NONE") delete next[session.id];
                                else next[session.id] = choice;
                                return next;
                              });
                              invalidatePreview();
                            }}
                            className={`btn px-2 text-xs ${choice === "NONE" ? (!selected ? "btn-primary" : "btn-ghost") : selected === choice ? "btn-primary" : "btn-ghost"}`}
                          >
                            {choice === "PRESENT" ? "Présent" : choice === "ABSENT" ? "Absent" : "Non saisi"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {preview ? (
            <section className="panel border-[var(--primary)]/30 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <h2 className="font-semibold">Prévalidation terminée</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{preview.memberName} · {preview.memberPhone}</p>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><span className="text-[var(--muted-foreground)]">Discipline</span><strong className="block">{preview.sportName}</strong></div>
                    <div><span className="text-[var(--muted-foreground)]">Groupe</span><strong className="block">{preview.groupName}</strong></div>
                    <div><span className="text-[var(--muted-foreground)]">Formule</span><strong className="block">{preview.planName}</strong></div>
                    <div><span className="text-[var(--muted-foreground)]">Solde financier</span><strong className="block">{formatMoney(preview.remainingBalanceCents)}</strong></div>
                  </div>
                  {preview.warnings.map((warning) => <p key={warning} className="mt-3 flex gap-2 text-sm text-amber-700"><AlertTriangle className="size-4 shrink-0" />{warning}</p>)}
                </div>
              </div>
            </section>
          ) : null}

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
