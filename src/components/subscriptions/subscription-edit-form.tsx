"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pause, Play, RefreshCw, SlidersHorizontal } from "lucide-react";

import {
  DEMO_READ_ONLY_MESSAGE,
  DemoMutationButton,
  useDemoReadOnly,
} from "@/components/ui/demo-read-only";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import { formatMoney } from "@/lib/money";

type EffectiveState = "PENDING_ACTIVATION" | "SCHEDULED" | "ACTIVE" | "FROZEN" | "EXPIRED" | "CANCELLED";

type PlanOption = {
  id: string;
  name: string;
  price: number;
  planKind: "CLASS" | "GYM" | "MIXED";
  entitlements: Array<{ type: "CLASS_SESSIONS" | "GYM_ACCESS"; sportId: string | null; sportName: string | null }>;
};

type GroupOption = { id: string; name: string; sportId: string; sportName: string };

type SubscriptionEditFormProps = {
  subscription: {
    id: string;
    memberName: string;
    planName: string;
    planId: string;
    startDate: string;
    endDate: string | null;
    amount: number;
    totalPaid: number;
    storedStatus: string;
    effectiveState: EffectiveState;
    activationDeadline: string | null;
    freezeAllowanceCount: number;
    freezeMaxTotalDays: number;
    usedPauseCount: number;
    usedPauseDays: number;
    entitlements: Array<{
      id: string;
      label: string;
      type: "CLASS_SESSIONS" | "GYM_ACCESS";
      remainingUnits: number | null;
    }>;
  };
  plansOptions: PlanOption[];
  groupsOptions: GroupOption[];
};

const stateLabels: Record<EffectiveState, string> = {
  PENDING_ACTIVATION: "En attente du premier passage",
  SCHEDULED: "Planifié",
  ACTIVE: "Actif",
  FROZEN: "En pause",
  EXPIRED: "Expiré",
  CANCELLED: "Résilié",
};

function dateInputValue(value: string) {
  return new Date(value).toISOString().split("T")[0];
}

export function SubscriptionEditForm({ subscription, plansOptions, groupsOptions }: SubscriptionEditFormProps) {
  const router = useRouter();
  const intent = useIdempotencyIntent();
  const demoReadOnly = useDemoReadOnly();
  const finiteEntitlements = subscription.entitlements.filter((right) => right.remainingUnits !== null);
  const [reason, setReason] = useState("");
  const [selectedEntitlementId, setSelectedEntitlementId] = useState(finiteEntitlements[0]?.id ?? "");
  const [unitsDelta, setUnitsDelta] = useState("0");
  const [replacementPlanId, setReplacementPlanId] = useState(subscription.planId);
  const [replacementStartDate, setReplacementStartDate] = useState(dateInputValue(subscription.startDate));
  const [groupBySport, setGroupBySport] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const replacementPlan = plansOptions.find((plan) => plan.id === replacementPlanId) ?? null;
  const replacementClassRights = useMemo(
    () => replacementPlan?.entitlements.filter((right) => right.type === "CLASS_SESSIONS" && right.sportId) ?? [],
    [replacementPlan],
  );
  const canPause =
    subscription.effectiveState === "ACTIVE" &&
    subscription.freezeAllowanceCount > subscription.usedPauseCount &&
    subscription.freezeMaxTotalDays > subscription.usedPauseDays;
  const canResume = subscription.effectiveState === "FROZEN";

  async function runAction(action: string, url: string, payload: Record<string, unknown>, method = "POST") {
    if (demoReadOnly) {
      setMessage(DEMO_READ_ONLY_MESSAGE);
      return false;
    }
    if (reason.trim().length < 3) {
      setMessage("Indiquez un motif précis avant de confirmer.");
      return false;
    }
    setLoadingAction(action);
    setMessage(null);
    const requestPayload = { ...payload, reason: reason.trim() };
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": intent.keyFor({ action, ...requestPayload }),
        },
        body: JSON.stringify(requestPayload),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Action impossible");
        return false;
      }
      intent.complete({ action, ...requestPayload });
      setReason("");
      router.refresh();
      return true;
    } catch {
      setMessage("Connexion interrompue. Réessayez: la même action ne sera pas enregistrée deux fois.");
      return false;
    } finally {
      setLoadingAction(null);
    }
  }

  async function adjustUnits() {
    const delta = Number(unitsDelta);
    if (!selectedEntitlementId || !Number.isInteger(delta) || delta === 0) {
      setMessage("Choisissez un droit et indiquez un nombre entier différent de zéro.");
      return;
    }
    const ok = await runAction(
      "adjust",
      `/api/member-subscriptions/${subscription.id}/entitlements/${selectedEntitlementId}/adjust`,
      { unitsDelta: delta },
    );
    if (ok) setUnitsDelta("0");
  }

  async function replaceSale() {
    const groupIds = replacementClassRights.map((right) => groupBySport[right.sportId as string]).filter(Boolean);
    if (!replacementPlanId || !replacementStartDate) {
      setMessage("Choisissez une formule et une date de correction.");
      return;
    }
    const ok = await runAction("replace", `/api/member-subscriptions/${subscription.id}/replace`, {
      planId: replacementPlanId,
      startDate: new Date(replacementStartDate).toISOString(),
      transferCents: subscription.totalPaid,
      groupIds,
    });
    if (ok) router.push("/subscriptions");
  }

  return (
    <div className="space-y-5">
      <ReceptionInfoCard variant="warning" title="Historique protégé">
        Une vente enregistrée n&apos;est jamais réécrite. Choisissez l&apos;action exacte; le motif, l&apos;ancienne valeur et la nouvelle valeur restent traçables.
      </ReceptionInfoCard>

      <section className="grid gap-3 border-b border-[var(--border)] pb-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs font-semibold text-[var(--muted-foreground)]">Membre</p><p className="mt-1 font-semibold">{subscription.memberName}</p></div>
        <div><p className="text-xs font-semibold text-[var(--muted-foreground)]">Formule</p><p className="mt-1 font-semibold">{subscription.planName}</p></div>
        <div><p className="text-xs font-semibold text-[var(--muted-foreground)]">État réel</p><p className="mt-1 font-semibold text-[var(--primary)]">{stateLabels[subscription.effectiveState]}</p></div>
        <div><p className="text-xs font-semibold text-[var(--muted-foreground)]">Payé / total</p><p className="mt-1 font-semibold">{formatMoney(subscription.totalPaid)} / {formatMoney(subscription.amount)}</p></div>
      </section>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Motif commun à l&apos;action *</span>
        <textarea className="field min-h-20 resize-y py-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. erreur de formule constatée avec le responsable" />
      </label>

      {(canPause || canResume) ? (
        <section className="border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold">Pause de l&apos;abonnement</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{subscription.usedPauseCount}/{subscription.freezeAllowanceCount} pause(s), {subscription.usedPauseDays}/{subscription.freezeMaxTotalDays} jours utilisés.</p></div>
            {canPause ? <DemoMutationButton type="button" className="btn btn-ghost" disabled={Boolean(loadingAction)} onClick={() => runAction("pause", `/api/member-subscriptions/${subscription.id}/pause`, {})}><Pause className="size-4" /> Mettre en pause</DemoMutationButton> : null}
            {canResume ? <DemoMutationButton type="button" className="btn btn-primary" disabled={Boolean(loadingAction)} onClick={() => runAction("resume", `/api/member-subscriptions/${subscription.id}/resume`, {})}><Play className="size-4" /> Reprendre</DemoMutationButton> : null}
          </div>
        </section>
      ) : null}

      {finiteEntitlements.length > 0 && subscription.effectiveState !== "CANCELLED" ? (
        <section className="border-t border-[var(--border)] pt-5">
          <div><h2 className="font-semibold">Corriger un solde</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Ajoutez ou retirez des unités sans effacer les consommations déjà enregistrées.</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <label><span className="mb-1 block text-xs font-medium">Droit</span><select className="field" value={selectedEntitlementId} onChange={(event) => setSelectedEntitlementId(event.target.value)}>{finiteEntitlements.map((right) => <option key={right.id} value={right.id}>{right.label} · reste {right.remainingUnits}</option>)}</select></label>
            <label><span className="mb-1 block text-xs font-medium">Correction</span><input className="field" type="number" step="1" value={unitsDelta} onChange={(event) => setUnitsDelta(event.target.value)} /></label>
            <DemoMutationButton type="button" className="btn btn-ghost" disabled={Boolean(loadingAction)} onClick={adjustUnits}><SlidersHorizontal className="size-4" /> Appliquer</DemoMutationButton>
          </div>
        </section>
      ) : null}

      {subscription.effectiveState !== "CANCELLED" ? (
        <details className="border-t border-[var(--border)] pt-5">
          <summary className="cursor-pointer list-none font-semibold text-[var(--foreground)]">Remplacer une vente incorrecte</summary>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">L&apos;abonnement actuel sera résilié, le crédit transféré et un nouveau reçu émis. L&apos;original reste conservé et annulé.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-xs font-medium">Nouvelle formule</span><select className="field" value={replacementPlanId} onChange={(event) => { setReplacementPlanId(event.target.value); setGroupBySport({}); }}>{plansOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.price)}</option>)}</select></label>
            <label><span className="mb-1 block text-xs font-medium">Date corrigée</span><input className="field" type="date" value={replacementStartDate} onChange={(event) => setReplacementStartDate(event.target.value)} /></label>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"><span className="block text-xs font-medium text-[var(--muted-foreground)]">Crédit transféré</span><strong className="mt-1 block text-sm">{formatMoney(subscription.totalPaid)}</strong><span className="mt-1 block text-xs text-[var(--muted-foreground)]">La totalité est déplacée pour garder des reçus cohérents.</span></div>
            {replacementClassRights.map((right) => {
              const sportId = right.sportId as string;
              return <label key={sportId}><span className="mb-1 block text-xs font-medium">Groupe · {right.sportName}</span><select className="field" value={groupBySport[sportId] ?? ""} onChange={(event) => setGroupBySport((current) => ({ ...current, [sportId]: event.target.value }))}><option value="">Conserver le groupe actif</option>{groupsOptions.filter((group) => group.sportId === sportId).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>;
            })}
          </div>
          <DemoMutationButton type="button" className="btn btn-primary mt-4" disabled={Boolean(loadingAction)} onClick={replaceSale}><RefreshCw className="size-4" /> Résilier et remplacer</DemoMutationButton>
        </details>
      ) : null}

      {subscription.effectiveState !== "CANCELLED" ? (
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <div><h2 className="font-semibold">Résilier sans remplacement</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Les paiements et droits passés restent visibles.</p></div>
          <DemoMutationButton type="button" className="btn btn-danger" disabled={Boolean(loadingAction)} onClick={() => runAction("cancel", "/api/member-subscriptions", { subscriptionId: subscription.id }, "DELETE")}><Ban className="size-4" /> Résilier</DemoMutationButton>
        </section>
      ) : null}

      <FeedbackMessage message={message ?? (loadingAction ? "Enregistrement en cours..." : null)} />
    </div>
  );
}
