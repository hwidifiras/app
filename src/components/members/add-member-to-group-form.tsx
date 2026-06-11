"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { formatGroupRoomLabel } from "@/lib/group-room";

type Plan = {
  id: string;
  planName: string;
  sportId: string | null;
  sportName: string;
  price: number;
  totalSessions: number;
  validityDays: number;
};

type Schedule = {
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
};

type Group = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  coachName: string;
  room: string | null;
  capacity: number;
  activeMembers: number;
  groupType: "KIDS" | "ADULTS";
  schedules: Schedule[];
};

type AddMemberToGroupFormProps = {
  memberId: string;
  memberName: string;
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
  plans: Plan[];
  availableGroups: Group[];
};

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

function isMemberAllowed(groupType: "KIDS" | "ADULTS", memberType: string) {
  if (groupType === "KIDS") {
    return memberType === "KID" || memberType === "NOT_SPECIFIED";
  }
  return memberType === "ADULT" || memberType === "NOT_SPECIFIED";
}

export function AddMemberToGroupForm({
  memberId,
  memberName,
  memberType,
  plans,
  availableGroups,
}: AddMemberToGroupFormProps) {
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => availableGroups.find((g) => g.id === selectedGroupId) ?? null,
    [selectedGroupId, availableGroups]
  );

  const filteredPlans = useMemo(() => {
    if (!selectedGroup) return plans;

    if (!selectedGroup.sportId) {
      return plans;
    }

    return plans.filter((plan) => !plan.sportId || plan.sportId === selectedGroup.sportId);
  }, [plans, selectedGroup]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [selectedPlanId, plans]
  );

  const isFull =
    selectedGroup && selectedGroup.activeMembers >= selectedGroup.capacity;

  const isGroupAllowed = selectedGroup
    ? isMemberAllowed(selectedGroup.groupType, memberType)
    : true;

  const canSubmit = selectedGroupId && selectedPlanId && !isFull && isGroupAllowed;

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedPlanId("");
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/group-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroupId,
          memberId,
          planId: selectedPlanId,
          startDate: new Date(`${startDate}T00:00:00Z`).toISOString(),
          endDate: endDate ? new Date(`${endDate}T00:00:00Z`).toISOString() : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Erreur lors de l'affectation");
        setLoading(false);
        return;
      }

      setMessage("Affectation réussie");
      setLoading(false);

      setTimeout(() => {
        router.push(`/members/${memberId}`);
      }, 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur serveur");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-soft p-4">
        <p className="text-xs font-medium text-muted-foreground">Membre</p>
        <p className="mt-2 text-base font-semibold text-foreground">
          {memberName}
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          Groupe *
        </label>
        <select
          value={selectedGroupId}
          onChange={(e) => handleGroupChange(e.target.value)}
          className="field"
          required
        >
          <option value="">Sélectionner un groupe</option>
          {availableGroups.map((group) => {
            const allowed = isMemberAllowed(group.groupType, memberType);
            const full = group.activeMembers >= group.capacity;

            return (
              <option key={group.id} value={group.id} disabled={!allowed || full}>
                {group.name} ({group.activeMembers}/{group.capacity}) {!allowed || full ? " [Indisponible]" : ""}
              </option>
            );
          })}
        </select>
      </div>

      {selectedGroup && (
        <div className="rounded-lg border border-border bg-surface-soft p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Détails du groupe
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coach:</span>
              <span className="font-medium">{selectedGroup.coachName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salle:</span>
              <span className="font-medium">{formatGroupRoomLabel(selectedGroup.room)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sport:</span>
              <span className="font-medium">{selectedGroup.sportName}</span>
            </div>
            {selectedGroup.schedules.length > 0 && (
              <div>
                <p className="text-muted-foreground">Planning:</p>
                <ul className="mt-1 space-y-1">
                  {selectedGroup.schedules.map((schedule) => (
                    <li key={`${schedule.dayOfWeek}-${schedule.startTime}`} className="text-xs font-medium">
                      {DAY_LABELS[schedule.dayOfWeek]} à {schedule.startTime}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedGroup && (
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Plan d'abonnement *
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="field"
            required
          >
            <option value="">Sélectionner un plan</option>
            {filteredPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.planName} — {plan.sportName}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedPlan && (
        <div className="rounded-lg border border-border bg-surface-soft p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Détails du plan
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sport:</span>
              <span className="font-medium">{selectedPlan.sportName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Séances:</span>
              <span className="font-medium">{selectedPlan.totalSessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prix:</span>
              <span className="font-medium">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(selectedPlan.price / 100)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Validité:</span>
              <span>{selectedPlan.validityDays} jour(s)</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Date de début
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Date de fin (optionnel)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="field"
          />
        </div>
      </div>

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.back()} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="btn btn-primary btn-block-mobile"
        >
          {loading ? "Affectation en cours..." : "Ajouter au groupe"}
        </button>
      </FormActions>
    </form>
  );
}
