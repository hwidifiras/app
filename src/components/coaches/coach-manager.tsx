"use client";

import { FormEvent, useMemo, useState } from "react";
import { UserRound } from "lucide-react";

import { CoachDto } from "@/types/coach";
import { SportDto } from "@/types/sport";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { CoachCard } from "@/components/coaches/coach-card";
import { qualifiedSportNames, toggleSportId, withPrimarySport } from "@/components/coaches/coach-manager-model";
import {
  CoachRuleCard,
  CoachSummaryMetric,
  coachRuleCards,
} from "@/components/coaches/coach-manager-ui";

type CoachManagerProps = {
  initialCoaches: CoachDto[];
  sportsOptions: SportDto[];
};

function dateInputToIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function isoToDateInput(value: string | null) {
  return value ? value.split("T")[0] : "";
}

function formatDateForSearch(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function CoachManager({ initialCoaches, sportsOptions }: CoachManagerProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sportId, setSportId] = useState("");
  const [qualifiedSportIds, setQualifiedSportIds] = useState<string[]>([]);
  const [sports, setSports] = useState<SportDto[]>(sportsOptions);
  const [coaches, setCoaches] = useState<CoachDto[]>(initialCoaches);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editSportId, setEditSportId] = useState("");
  const [editQualifiedSportIds, setEditQualifiedSportIds] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [blockedCoach, setBlockedCoach] = useState<null | { name: string; groups: Array<{ id: string; name: string }> }>(null);
  const [pendingDeleteCoach, setPendingDeleteCoach] = useState<CoachDto | null>(null);

  async function reloadCoaches(query?: string) {
    const params = new URLSearchParams();
    if (query && query.trim().length > 0) {
      params.set("q", query.trim());
    }

    const endpoint = params.toString() ? `/api/coaches?${params.toString()}` : "/api/coaches";
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    setCoaches(result.data ?? []);
  }

  async function reloadSports() {
    const response = await fetch("/api/sports?active=true", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) {
      setSports(result.data ?? []);
    }
  }

  const filteredCoaches = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    if (!query) return coaches;
    return coaches.filter((coach) =>
      [
        coach.firstName,
        coach.lastName,
        coach.phone,
        coach.email ?? "",
        formatDateForSearch(coach.birthDate),
        coach.sportName ?? "",
        qualifiedSportNames(coach),
      ].some((value) => value.toLocaleLowerCase("fr").includes(query)),
    );
  }, [coaches, searchTerm]);
  const overview = useMemo(() => {
    const active = coaches.filter((coach) => coach.isActive).length;
    const inactive = coaches.length - active;
    const withoutSpecialty = coaches.filter((coach) => coach.isActive && coach.qualifiedSports.length === 0).length;
    const activeGroups = coaches.reduce((sum, coach) => sum + coach.activeGroupCount, 0);
    const weeklySchedules = coaches.reduce((sum, coach) => sum + coach.weeklyScheduleCount, 0);

    return { active, inactive, withoutSpecialty, activeGroups, weeklySchedules };
  }, [coaches]);
  const pagination = usePagination(filteredCoaches, 15, searchTerm);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        email,
        birthDate: dateInputToIso(birthDate),
        sportId,
        qualifiedSportIds: withPrimarySport(qualifiedSportIds, sportId),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du coach");
      setLoading(false);
      return;
    }

    setMessage("Coach créé avec succès");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setBirthDate("");
    setSportId("");
    setQualifiedSportIds([]);
    await reloadCoaches();
    setLoading(false);
  }

  function startEdit(coach: CoachDto) {
    setEditingId(coach.id);
    setEditFirstName(coach.firstName);
    setEditLastName(coach.lastName);
    setEditPhone(coach.phone);
    setEditEmail(coach.email ?? "");
    setEditBirthDate(isoToDateInput(coach.birthDate));
    setEditSportId(coach.sportId ?? "");
    setEditQualifiedSportIds(coach.qualifiedSportIds);
    setEditIsActive(coach.isActive);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFirstName("");
    setEditLastName("");
    setEditPhone("");
    setEditEmail("");
    setEditBirthDate("");
    setEditSportId("");
    setEditQualifiedSportIds([]);
    setEditIsActive(true);
  }

  async function saveEdit(coachId: string) {
    setActionLoadingId(coachId);
    setMessage(null);

    const response = await fetch("/api/coaches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachId,
        payload: {
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPhone,
          email: editEmail,
          birthDate: dateInputToIso(editBirthDate),
          sportId: editSportId,
          qualifiedSportIds: withPrimarySport(editQualifiedSportIds, editSportId),
          isActive: editIsActive,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification du coach");
      setActionLoadingId(null);
      return;
    }

    setMessage("Coach modifié avec succès");
    cancelEdit();
    await reloadCoaches();
    setActionLoadingId(null);
  }

  async function deleteCoach(coachId: string) {
    const coachRecord = coaches.find((item) => item.id === coachId);
    const coachLabel = coachRecord ? `${coachRecord.firstName} ${coachRecord.lastName}` : "Coach";

    setActionLoadingId(coachId);
    setMessage(null);

    const response = await fetch("/api/coaches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 409 && result.details?.groups?.length) {
        setPendingDeleteCoach(null);
        setBlockedCoach({ name: coachLabel.trim(), groups: result.details.groups });
      }
      setMessage(result.error ?? "Erreur lors de la désactivation du coach");
      setActionLoadingId(null);
      return;
    }

    setMessage("Coach désactivé avec succès");
    setPendingDeleteCoach(null);
    if (editingId === coachId) {
      cancelEdit();
    }
    await reloadCoaches();
    setActionLoadingId(null);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CoachSummaryMetric label="Coachs actifs" value={overview.active} detail={`${overview.inactive} désactivé(s)`} tone="success" />
        <CoachSummaryMetric
          label="Spécialités"
          value={overview.withoutSpecialty}
          detail={overview.withoutSpecialty > 0 ? "Coach(s) à compléter" : "Tous les actifs sont qualifiés"}
          tone={overview.withoutSpecialty > 0 ? "warning" : "success"}
        />
        <CoachSummaryMetric label="Cours affectés" value={overview.activeGroups} detail="Groupes actifs avec coach" />
        <CoachSummaryMetric label="Charge semaine" value={overview.weeklySchedules} detail="Créneaux horaires actifs" />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {coachRuleCards.map((card) => (
          <CoachRuleCard key={card.title} icon={card.icon} title={card.title} tone={card.tone}>
            {card.text}
          </CoachRuleCard>
        ))}
      </section>

      <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.25fr)]">
        <section id="coach-create" className="panel order-2 scroll-mt-24 p-4 sm:p-5 lg:order-1">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Ajouter un coach</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Créez le coach, sa spécialité principale et les disciplines qu&apos;il peut encadrer.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <FormGrid>
              <FormField label="Prénom" htmlFor="coach-first-name">
                <input
                  id="coach-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="field"
                  required
                />
              </FormField>
              <FormField label="Nom" htmlFor="coach-last-name">
                <input
                  id="coach-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="field"
                  required
                />
              </FormField>
              <FormField label="Téléphone" htmlFor="coach-phone">
                <input
                  id="coach-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field"
                  inputMode="tel"
                  required
                />
              </FormField>
              <FormField label="Email" htmlFor="coach-email" hint="Optionnel">
                <input
                  id="coach-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                  type="email"
                />
              </FormField>
              <FormField label="Date de naissance" htmlFor="coach-birth-date" hint="Optionnel">
                <input
                  id="coach-birth-date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="field"
                  type="date"
                />
              </FormField>
            </FormGrid>
            <FormField label="Spécialité principale" htmlFor="coach-sport" hint="Sert de repère dans les groupes et le planning.">
              <select
                id="coach-sport"
                value={sportId}
                onFocus={() => void reloadSports()}
                onClick={() => void reloadSports()}
                onChange={(e) => {
                  const nextSportId = e.target.value;
                  setSportId(nextSportId);
                  if (nextSportId) {
                    setQualifiedSportIds((current) => withPrimarySport(current, nextSportId));
                  }
                }}
                className="field"
              >
                <option value="">Spécialité à compléter</option>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </FormField>

            {sports.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Disciplines autorisées</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sports.map((sport) => (
                    <label key={sport.id} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <input
                        type="checkbox"
                        checked={withPrimarySport(qualifiedSportIds, sportId).includes(sport.id)}
                        disabled={sport.id === sportId}
                        onChange={() => setQualifiedSportIds((current) => toggleSportId(current, sport.id))}
                      />
                      <span className="truncate text-[var(--foreground)]">{sport.name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Le planning utilise ces disciplines pour savoir si un coach peut couvrir deux cours ou une exception.
                </p>
              </div>
            ) : null}

            <FormActions>
              <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
                {loading ? "Enregistrement…" : "Créer le coach"}
              </button>
            </FormActions>
          </form>

          <FeedbackMessage message={message} className="mt-4" />
        </section>

        <section className="panel order-1 p-4 sm:p-5 lg:order-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--foreground)]">Coachs enregistrés</h2>
              <span className="text-xs text-[var(--muted-foreground)]">
                {filteredCoaches.length} coach{filteredCoaches.length > 1 ? "s" : ""}
              </span>
            </div>
            <ListSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Nom, téléphone, email ou spécialité..."
            />
          </div>

          <ul className="mt-4 space-y-2">
            {pagination.pageItems.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                sports={sports}
                editing={editingId === coach.id}
                actionBusy={actionLoadingId === coach.id}
                editFirstName={editFirstName}
                editLastName={editLastName}
                editPhone={editPhone}
                editEmail={editEmail}
                editBirthDate={editBirthDate}
                editSportId={editSportId}
                editQualifiedSportIds={editQualifiedSportIds}
                editIsActive={editIsActive}
                onReloadSports={() => { void reloadSports(); }}
                onStartEdit={() => startEdit(coach)}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => { void saveEdit(coach.id); }}
                onQueueDelete={() => setPendingDeleteCoach(coach)}
                onEditFirstNameChange={setEditFirstName}
                onEditLastNameChange={setEditLastName}
                onEditPhoneChange={setEditPhone}
                onEditEmailChange={setEditEmail}
                onEditBirthDateChange={setEditBirthDate}
                onEditSportIdChange={setEditSportId}
                onEditQualifiedSportIdsChange={setEditQualifiedSportIds}
                onEditIsActiveChange={setEditIsActive}
              />
            ))}
            {filteredCoaches.length === 0 ? (
              <li>
                <EmptyState
                  icon={<UserRound className="size-8 opacity-45" />}
                  title={coaches.length === 0 ? "Aucun coach" : "Aucun résultat"}
                  message={
                    coaches.length === 0
                      ? "Ajoutez le premier coach et sa spécialité."
                      : "Essayez un autre terme ou effacez la recherche."
                  }
                  action={
                    searchTerm ? (
                      <button type="button" onClick={() => setSearchTerm("")} className="btn btn-ghost">
                        Effacer la recherche
                      </button>
                    ) : undefined
                  }
                  className="py-8"
                />
              </li>
            ) : null}
          </ul>
          <Pagination
            currentPage={pagination.currentPage}
            pageCount={pagination.pageCount}
            totalItems={filteredCoaches.length}
            pageSize={15}
            onPageChange={pagination.setPage}
          />
        </section>
      </div>

      {blockedCoach ? (
        <div className="mobile-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/40">
          <div className="mobile-modal-panel border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-floating)] md:rounded-lg">
            <h3 className="text-base font-semibold text-[var(--foreground)]">Désactivation impossible</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Le coach <span className="font-medium text-[var(--foreground)]">{blockedCoach.name}</span> est assigné aux groupes suivants. Affectez ces groupes à un autre coach avant de le désactiver.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
              {blockedCoach.groups.map((group) => (
                <li key={group.id}>{group.name}</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedCoach(null)}
                className="btn btn-primary btn-block-mobile"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteCoach !== null}
        title="Désactiver ce coach ?"
        description={`${pendingDeleteCoach?.firstName ?? ""} ${pendingDeleteCoach?.lastName ?? ""} sera retiré des nouvelles configurations sans effacer l'historique. Si des groupes actifs l'utilisent encore, l'action sera bloquée.`}
        confirmLabel="Désactiver le coach"
        loading={actionLoadingId === pendingDeleteCoach?.id}
        onCancel={() => setPendingDeleteCoach(null)}
        onConfirm={() => pendingDeleteCoach ? deleteCoach(pendingDeleteCoach.id) : undefined}
      />
    </div>
  );
}
