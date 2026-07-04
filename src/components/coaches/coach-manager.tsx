"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Trash2, UserRound } from "lucide-react";

import { CoachDto } from "@/types/coach";
import { SportDto } from "@/types/sport";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { Pagination, usePagination } from "@/components/ui/pagination";

type CoachManagerProps = {
  initialCoaches: CoachDto[];
  sportsOptions: SportDto[];
};

function withPrimarySport(ids: string[], primarySportId: string) {
  const normalized = new Set(ids.filter(Boolean));
  if (primarySportId) normalized.add(primarySportId);
  return Array.from(normalized);
}

function toggleSportId(ids: string[], sportId: string) {
  return ids.includes(sportId)
    ? ids.filter((id) => id !== sportId)
    : [...ids, sportId];
}

function qualifiedSportNames(coach: CoachDto) {
  return coach.qualifiedSports.map((sport) => sport.name).join(", ");
}

export function CoachManager({ initialCoaches, sportsOptions }: CoachManagerProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
        coach.sportName ?? "",
        qualifiedSportNames(coach),
      ].some((value) => value.toLocaleLowerCase("fr").includes(query)),
    );
  }, [coaches, searchTerm]);
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
      setMessage(result.error ?? "Erreur lors de la suppression du coach");
      setActionLoadingId(null);
      return;
    }

    setMessage("Coach supprimé avec succès");
    setPendingDeleteCoach(null);
    if (editingId === coachId) {
      cancelEdit();
    }
    await reloadCoaches();
    setActionLoadingId(null);
  }

  return (
    <div>
      <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.25fr)]">
        <section id="coach-create" className="panel order-2 scroll-mt-24 p-4 sm:p-5 lg:order-1">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Ajouter un coach</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Créer un nouveau coach avec sa spécialité sportive.
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
            </FormGrid>
            <FormField label="Spécialité" htmlFor="coach-sport" hint="Optionnelle">
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
                <option value="">Spécialité non renseignée</option>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </FormField>

            {sports.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Sports autorises</p>
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
              <li key={coach.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                {editingId === coach.id ? (
                  <div className="space-y-2">
                    <input
                      aria-label="Prénom du coach"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Prénom"
                      className="field text-xs"
                    />
                    <input
                      aria-label="Nom du coach"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Nom"
                      className="field text-xs"
                    />
                    <input
                      aria-label="Téléphone du coach"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Téléphone"
                      className="field text-xs"
                    />
                    <input
                      aria-label="Email du coach"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="field text-xs"
                    />
                    <select
                      aria-label="Spécialité du coach"
                      value={editSportId}
                      onFocus={() => void reloadSports()}
                      onClick={() => void reloadSports()}
                      onChange={(e) => {
                        const nextSportId = e.target.value;
                        setEditSportId(nextSportId);
                        if (nextSportId) {
                          setEditQualifiedSportIds((current) => withPrimarySport(current, nextSportId));
                        }
                      }}
                      className="field text-xs"
                    >
                      <option value="">Spécialité non renseignée</option>
                      {sports.map((sport) => (
                        <option key={sport.id} value={sport.id}>
                          {sport.name}
                        </option>
                      ))}
                    </select>
                    {sports.length > 0 ? (
                      <div className="grid gap-1 sm:grid-cols-2">
                        {sports.map((sport) => (
                          <label key={sport.id} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                            <input
                              type="checkbox"
                              checked={withPrimarySport(editQualifiedSportIds, editSportId).includes(sport.id)}
                              disabled={sport.id === editSportId}
                              onChange={() => setEditQualifiedSportIds((current) => toggleSportId(current, sport.id))}
                            />
                            <span className="truncate text-[var(--foreground)]">{sport.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                      />
                      Coach actif
                    </label>
                    <div className="list-card-actions mt-3">
                      <button
                        type="button"
                        onClick={() => saveEdit(coach.id)}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-primary btn-block-mobile"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-ghost btn-block-mobile"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                        {coach.firstName[0]}
                        {coach.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {coach.firstName} {coach.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)] sm:grid-cols-5">
                      <span className="truncate" data-label="Téléphone">{coach.phone}</span>
                      <span className="truncate" data-label="Email">{coach.email ?? "—"}</span>
                      <span className="truncate" data-label="Spécialité">{coach.sportName ?? "—"}</span>
                      <span className="truncate" data-label="Autorisations">{qualifiedSportNames(coach) || "-"}</span>
                      <span data-label="Statut">
                        <StatusBadge variant={coach.isActive ? "success" : "muted"}>
                          {coach.isActive ? "Actif" : "Inactif"}
                        </StatusBadge>
                      </span>
                    </div>
                    <div className="list-card-actions mt-1 shrink-0 md:mt-0 md:justify-end">
                      <button
                        type="button"
                        onClick={() => startEdit(coach)}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-ghost btn-sm inline-flex items-center justify-center md:size-9 md:p-0"
                        title="Modifier"
                        aria-label="Modifier"
                      >
                        <Pencil className="size-4" />
                        <span className="md:hidden">Modifier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteCoach(coach)}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-danger btn-sm inline-flex items-center justify-center md:size-9 md:p-0"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-4" />
                        <span className="md:hidden">Supprimer</span>
                      </button>
                    </div>
                  </div>
                )}
              </li>
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
            <h3 className="text-base font-semibold text-[var(--foreground)]">Suppression impossible</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Le coach <span className="font-medium text-[var(--foreground)]">{blockedCoach.name}</span> est assigne aux groupes suivants :
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
        title="Supprimer ce coach ?"
        description={`${pendingDeleteCoach?.firstName ?? ""} ${pendingDeleteCoach?.lastName ?? ""} sera supprimé si aucun groupe ne lui est encore affecté.`}
        confirmLabel="Supprimer le coach"
        loading={actionLoadingId === pendingDeleteCoach?.id}
        onCancel={() => setPendingDeleteCoach(null)}
        onConfirm={() => pendingDeleteCoach ? deleteCoach(pendingDeleteCoach.id) : undefined}
      />
    </div>
  );
}
