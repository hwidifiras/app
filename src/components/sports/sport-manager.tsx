"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { SportDto } from "@/types/sport";

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
    await reloadSports();
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
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Gestion des sports</h1>
      </div>

      <div className="grid w-full gap-6 md:grid-cols-2">
        <section className="panel panel-soft p-6">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">US-03 - Référentiel sports</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Référentiel des disciplines du club avec activation et maintenance rapide.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/" className="font-medium text-[var(--primary)] underline">
              Retour à la gestion des membres
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
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

          {message ? <p className="mt-4 text-sm text-[var(--foreground)]">{message}</p> : null}
        </section>

        <section className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Sports enregistrés</h2>
            <form onSubmit={onSearchSubmit} className="flex w-full gap-2 sm:w-auto">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom/description"
                className="field text-xs sm:w-56"
              />
              <button type="submit" className="btn btn-ghost whitespace-nowrap">
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
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                      />
                      Sport actif
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(sport.id)}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-primary"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={actionLoadingId === sport.id}
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
                        <p className="text-sm font-medium text-[var(--foreground)]">{sport.name}</p>
                        <p className="text-xs text-[var(--muted)]">{sport.description ?? "-"}</p>
                      </div>
                      <span className={`chip ${sport.isActive ? "chip-active" : "chip-muted"}`}>
                        {sport.isActive ? "ACTIF" : "INACTIF"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(sport)}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-ghost"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSport(sport.id)}
                        disabled={actionLoadingId === sport.id}
                        className="btn btn-danger"
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {sports.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                Aucun sport enregistré pour le moment.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
