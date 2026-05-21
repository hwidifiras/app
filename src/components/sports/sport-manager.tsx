"use client";

import { FormEvent, useState } from "react";

import { SportDto } from "@/types/sport";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type SportManagerProps = {
  initialSports: SportDto[];
};

export function SportManager({ initialSports }: SportManagerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sports, setSports] = useState<SportDto[]>(initialSports);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [blockedSport, setBlockedSport] = useState<null | {
    name: string;
    groups: Array<{ id: string; name: string }>;
    plans: Array<{ id: string; name: string }>;
    subscriptions: Array<{ id: string; label: string }>;
  }>(null);

  async function reloadSports(query?: string) {
    const params = new URLSearchParams();
    if (query && query.trim().length > 0) {
      params.set("q", query.trim());
    }
    const endpoint = params.toString() ? `/api/sports?${params.toString()}` : "/api/sports";
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    setSports(result.data ?? []);
  }

  async function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reloadSports(searchTerm);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/sports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du sport");
      setLoading(false);
      return;
    }

    setMessage("Sport créé avec succès");
    setName("");
    setDescription("");
    await reloadSports(searchTerm);
    setLoading(false);
  }

  function startEdit(sport: SportDto) {
    setEditingId(sport.id);
    setEditName(sport.name);
    setEditDescription(sport.description ?? "");
    setEditIsActive(sport.isActive);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditIsActive(true);
  }

  async function saveEdit(sportId: string) {
    setActionLoadingId(sportId);
    setMessage(null);

    const response = await fetch("/api/sports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sportId,
        payload: {
          name: editName,
          description: editDescription,
          isActive: editIsActive,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification du sport");
      setActionLoadingId(null);
      return;
    }

    setMessage("Sport modifié avec succès");
    cancelEdit();
    await reloadSports();
    setActionLoadingId(null);
  }

  async function deleteSport(sportId: string) {
    const confirmed = window.confirm("Confirmer la suppression de ce sport ?");
    if (!confirmed) {
      return;
    }

    setActionLoadingId(sportId);
    setMessage(null);

    const response = await fetch("/api/sports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportId }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 409 && result.details) {
        const sportName = sports.find((item) => item.id === sportId)?.name ?? "Sport";
        const details = result.details as {
          groups?: Array<{ id: string; name: string }>;
          plans?: Array<{ id: string; name: string }>;
          subscriptions?: Array<{ id: string; label: string }>;
        };
        setBlockedSport({
          name: sportName,
          groups: details.groups ?? [],
          plans: details.plans ?? [],
          subscriptions: details.subscriptions ?? [],
        });
      }
      setMessage(result.error ?? "Erreur lors de la suppression du sport");
      setActionLoadingId(null);
      return;
    }

    setMessage("Sport supprimé avec succès");
    if (editingId === sportId) {
      cancelEdit();
    }
    await reloadSports();
    setActionLoadingId(null);
  }

  return (
    <div>
      <div className="grid w-full gap-6 md:grid-cols-2">
        <section className="panel panel-soft p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Ajouter un sport</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Créer une nouvelle discipline pour le club.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du sport"
              className="field"
              required
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnelle)"
              className="field"
              rows={3}
            />

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm">
              {loading ? "Enregistrement..." : "Créer sport"}
            </button>
          </form>

          <FeedbackMessage message={message} className="mt-4" />
        </section>

        <section className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Sports enregistrés</h2>
            <form onSubmit={onSearchSubmit} className="flex w-full flex-col gap-2 sm:flex-row sm:w-auto">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom/description"
                className="field text-xs sm:w-56"
              />
              <button type="submit" className="btn btn-ghost btn-block-mobile whitespace-nowrap">
                Rechercher
              </button>
            </form>
          </div>

          <ul className="mt-4 space-y-3">
            {sports.map((sport) => (
              <li key={sport.id} className="rounded-xl border border-[var(--border)] p-3">
                {editingId === sport.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nom du sport"
                      className="field text-xs"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      className="field text-xs"
                      rows={2}
                    />
                    <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                      />
                      Sport actif
                    </label>
                    <div className="list-card-actions">
                      <button
                        type="button"
                        onClick={() => saveEdit(sport.id)}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-primary btn-block-mobile"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-ghost btn-block-mobile"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{sport.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{sport.description ?? "-"}</p>
                      </div>
                      <StatusBadge variant={sport.isActive ? "success" : "muted"}>
                        {sport.isActive ? "Actif" : "Inactif"}
                      </StatusBadge>
                    </div>
                    <div className="list-card-actions mt-3">
                      <button
                        type="button"
                        onClick={() => startEdit(sport)}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-ghost btn-block-mobile"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSport(sport.id)}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-danger btn-block-mobile"
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {sports.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]">
                Aucun sport enregistré pour le moment.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {blockedSport ? (
        <div className="mobile-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/40">
          <div className="mobile-modal-panel border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg md:rounded-xl">
            <h3 className="text-base font-semibold text-[var(--foreground)]">Suppression impossible</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              La discipline <span className="font-medium text-[var(--foreground)]">{blockedSport.name}</span> est
              encore utilisée. Supprimez ou réaffectez les éléments liés, ou désactivez-la (Modifier → décocher
              &quot;actif&quot;).
            </p>
            {blockedSport.groups.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Cours</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {blockedSport.groups.map((group) => (
                    <li key={group.id}>{group.name}</li>
                  ))}
                </ul>
              </>
            )}
            {blockedSport.plans.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Formules</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {blockedSport.plans.map((plan) => (
                    <li key={plan.id}>{plan.name}</li>
                  ))}
                </ul>
              </>
            )}
            {blockedSport.subscriptions.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Abonnements</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {blockedSport.subscriptions.map((sub) => (
                    <li key={sub.id}>{sub.label}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedSport(null)}
                className="btn btn-primary btn-block-mobile"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
