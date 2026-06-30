"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, LockKeyhole, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormSectionNav } from "@/components/ui/form-layout";

type GroupOption = {
  id: string;
  name: string;
  groupType: "KIDS" | "ADULTS";
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

type RecentImport = {
  id: string;
  memberId: string;
  memberName: string;
  createdAt: string;
  canRollback: boolean;
};

type ImportStatus = {
  active: boolean;
  expiresAt: string | null;
  recentImports: RecentImport[];
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

type BulkImportRow = {
  rowNumber: number;
  externalId: string;
  memberName: string;
  groupName: string;
  planName: string;
  status: "OK" | "ERROR" | "IMPORTED";
  errors: string[];
  warnings: string[];
  memberId?: string;
  remainingBalanceCents?: number;
};

type BulkImportResult = {
  totalRows: number;
  okRows: number;
  errorRows: number;
  importedRows: number;
  rows: BulkImportRow[];
};

const today = new Date().toISOString().slice(0, 10);
const templateUrl = "/templates/we-discipline-first-client-bulk-import.xlsx";

function isoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function eurosToCents(value: string) {
  return Math.round((Number.parseFloat(value.replace(",", ".")) || 0) * 100);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
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
  const [note, setNote] = useState("Reprise initiale depuis le registre papier");
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
      amountCents: eurosToCents(amount),
      paidCents: eurosToCents(paid),
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
      setMessage(json.error ?? "Impossible de charger le mode de reprise.");
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
    setMessage(action === "activate" ? "Session de reprise activée." : "Session de reprise fermée.");
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
      setMessage(json.error ?? "La reprise n'a pas pu être validée.");
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
    if (!window.confirm("Annuler entièrement cette reprise ?")) return;
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
    setMessage("Reprise annulée.");
    await loadStatus();
    router.refresh();
  }

  async function submitBulk(action: "preview" | "apply") {
    if (!bulkFile) {
      setMessage("Choisissez le fichier Excel de reprise.");
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
    return <section className="panel p-5 text-sm text-[var(--muted-foreground)]">Chargement du mode de reprise…</section>;
  }

  return (
    <div className="space-y-5">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`rounded-xl p-2.5 ${status.active ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"}`}>
              {status.active ? <CheckCircle2 className="size-5" /> : <LockKeyhole className="size-5" />}
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">
                {status.active ? "Session de reprise ouverte" : "Mode de reprise fermé"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {status.active
                  ? `Réservé à cet administrateur jusqu'à ${expiresLabel}.`
                  : "Aucune donnée spéciale ne peut être importée tant que ce mode est fermé."}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void modeAction(status.active ? "deactivate" : "activate")}
            className={`btn ${status.active ? "btn-ghost" : "btn-primary"} btn-block-mobile`}
          >
            {status.active ? "Fermer maintenant" : "Activer pour 4 heures"}
          </button>
        </div>
      </section>

      <FeedbackMessage
        message={message}
        variant={message?.includes("réuss") || message?.includes("activée") || message?.includes("annulée") ? "success" : undefined}
      />

      {status.active ? (
        <>
          <section className="panel p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">Import Excel</p>
                <h2 className="mt-1 text-lg font-semibold">Reprise en masse</h2>
                <p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">
                  Utilisez le modele, gardez les noms de groupes/formules tels qu&apos;ils existent dans le club, puis lancez la prevalidation avant d&apos;importer.
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

            {bulkPreview ? (
              <div className="mt-5 space-y-3">
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-[var(--surface-soft)] p-3"><span className="text-[var(--muted-foreground)]">Lignes</span><strong className="block">{bulkPreview.totalRows}</strong></div>
                  <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-700"><span>Valides</span><strong className="block">{bulkPreview.okRows}</strong></div>
                  <div className="rounded-lg bg-red-500/10 p-3 text-red-700"><span>Erreurs</span><strong className="block">{bulkPreview.errorRows}</strong></div>
                  <div className="rounded-lg bg-blue-500/10 p-3 text-blue-700"><span>Importees</span><strong className="block">{bulkPreview.importedRows}</strong></div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[var(--surface-soft)] text-xs uppercase text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-3 py-2">Ligne</th>
                        <th className="px-3 py-2">Membre</th>
                        <th className="px-3 py-2">Groupe</th>
                        <th className="px-3 py-2">Formule</th>
                        <th className="px-3 py-2">Solde</th>
                        <th className="px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {bulkPreview.rows.slice(0, 50).map((row) => (
                        <tr key={`${row.rowNumber}-${row.externalId}`}>
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-medium">{row.memberName || row.externalId}</td>
                          <td className="px-3 py-2">{row.groupName}</td>
                          <td className="px-3 py-2">{row.planName}</td>
                          <td className="px-3 py-2">{formatMoney(row.remainingBalanceCents ?? 0)}</td>
                          <td className="px-3 py-2">
                            <span className={row.status === "ERROR" ? "text-red-700" : row.status === "IMPORTED" ? "text-blue-700" : "text-emerald-700"}>
                              {row.status === "ERROR" ? row.errors.join(" · ") : row.status === "IMPORTED" ? "Importe" : row.warnings.join(" · ") || "Valide"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
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
              <h2 className="mt-1 text-lg font-semibold">Membre à reprendre</h2>
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
              <label className="text-sm font-medium">Montant total dû (€) *
                <input type="number" min="0" step="0.01" className="field mt-1" value={amount} onChange={(event) => { setAmount(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Déjà payé (€) *
                <input type="number" min="0" step="0.01" className="field mt-1" value={paid} onChange={(event) => { setPaid(event.target.value); invalidatePreview(); }} required />
              </label>
              <label className="text-sm font-medium">Date du solde repris
                <input type="date" className="field mt-1" value={paymentDate} max={cutoverDate} onChange={(event) => { setPaymentDate(event.target.value); invalidatePreview(); }} />
              </label>
              <label className="text-sm font-medium">Origine du règlement
                <select className="field mt-1" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); invalidatePreview(); }}>
                  <option value="REPRISE_PAPIER">Reprise papier</option>
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte</option>
                  <option value="TRANSFER">Virement</option>
                  <option value="CHECK">Chèque</option>
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">Note de reprise *
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
              <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
                Aucune séance passée disponible cette semaine pour ce groupe.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {eligibleSessions.map((session) => {
                  const selected = attendanceStatuses[session.id];
                  return (
                    <div key={session.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
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

          <div className="sticky bottom-20 z-20 flex flex-col-reverse gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:flex-row sm:justify-end">
            <button type="submit" disabled={busy} className="btn btn-ghost btn-block-mobile">
              Vérifier toutes les contraintes
            </button>
            <button type="button" disabled={busy || !preview} onClick={() => void submit("apply")} className="btn btn-primary btn-block-mobile">
              <Upload className="size-4" /> Appliquer la reprise
            </button>
          </div>
        </form>
        </>
      ) : null}

      <section className="panel p-4 sm:p-5">
        <h2 className="font-semibold">Dernières reprises</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                L&apos;annulation reste disponible seulement tant qu&apos;aucune nouvelle activité n&apos;est liée au membre.
        </p>
        <div className="mt-4 space-y-2">
          {status.recentImports.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Aucune reprise enregistrée.</p>
          ) : status.recentImports.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{item.memberName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{new Date(item.createdAt).toLocaleString("fr-FR")}</p>
              </div>
              {item.canRollback && status.active ? (
                <button type="button" disabled={busy} onClick={() => void rollback(item.id)} className="btn btn-ghost text-[var(--danger)]">
                  <RotateCcw className="size-4" /> Annuler la reprise
                </button>
              ) : (
                <span className="text-xs text-[var(--muted-foreground)]">Annulation indisponible</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
