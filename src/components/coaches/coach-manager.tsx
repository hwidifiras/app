"use client";

import { FormEvent, useState } from "react";

import { CoachDto } from "@/types/coach";
import { SportDto } from "@/types/sport";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type CoachManagerProps = {
  initialCoaches: CoachDto[];
  sportsOptions: SportDto[];
};

export function CoachManager({ initialCoaches, sportsOptions }: CoachManagerProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sportId, setSportId] = useState("");
  const [coaches, setCoaches] = useState<CoachDto[]>(initialCoaches);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSportId, setEditSportId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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

  async function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reloadCoaches(searchTerm);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, email, sportId }),
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
    const confirmed = window.confirm("Confirmer la suppression de ce coach ?");
    if (!confirmed) {
      return;
    }

    setActionLoadingId(coachId);
    setMessage(null);

    const response = await fetch("/api/coaches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression du coach");
      setActionLoadingId(null);
      return;
    }

    setMessage("Coach supprimé avec succès");
    if (editingId === coachId) {
      cancelEdit();
    }
    await reloadCoaches();
    setActionLoadingId(null);
  }

  return (
    <div>
      <div className="grid w-full gap-6 md:grid-cols-2">
        <section className="panel panel-soft p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Ajouter un coach</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Créer un nouveau coach avec sa spécialité sportive.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom"
              className="field"
              required
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              className="field"
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone"
              className="field"
              required
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optionnel)"
              className="field"
            />
            <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="field">
              <option value="">Spécialité non renseignée</option>
              {sportsOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm">
              {loading ? "Enregistrement..." : "Créer coach"}
            </button>
          </form>

          <FeedbackMessage message={message} className="mt-4" />
        </section>

        <section className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Coachs enregistrés</h2>
            <form onSubmit={onSearchSubmit} className="flex w-full gap-2 sm:w-auto">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom/téléphone"
                className="field text-xs sm:w-56"
              />
              <button type="submit" className="btn btn-ghost whitespace-nowrap">
                Rechercher
              </button>
            </form>
          </div>

          <ul className="mt-4 space-y-3">
            {coaches.map((coach) => (
              <li key={coach.id} className="rounded-xl border border-[var(--border)] p-3">
                {editingId === coach.id ? (
                  <div className="space-y-2">
                    <input
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Prénom"
                      className="field text-xs"
                    />
                    <input
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Nom"
                      className="field text-xs"
                    />
                    <input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Téléphone"
                      className="field text-xs"
                    />
                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="field text-xs"
                    />
                    <select value={editSportId} onChange={(e) => setEditSportId(e.target.value)} className="field text-xs">
                      <option value="">Spécialité non renseignée</option>
                      {sportsOptions.map((sport) => (
                        <option key={sport.id} value={sport.id}>
                          {sport.name}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                      />
                      Coach actif
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(coach.id)}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-primary"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-ghost"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {coach.firstName} {coach.lastName}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{coach.phone}</p>
                        <p className="text-xs text-[var(--muted)]">{coach.email ?? "-"}</p>
                        <p className="text-xs text-[var(--muted)]">Spécialité: {coach.sportName ?? "-"}</p>
                      </div>
                      <StatusBadge variant={coach.isActive ? "success" : "muted"}>
                        {coach.isActive ? "Actif" : "Inactif"}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(coach)}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-ghost"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCoach(coach.id)}
                        disabled={actionLoadingId === coach.id}
                        className="btn btn-danger"
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {coaches.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                Aucun coach enregistré pour le moment.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
