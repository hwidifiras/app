"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Dumbbell, MoreHorizontal, Plus, Settings2, X } from "lucide-react";

import { SportDto } from "@/types/sport";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SportSuggestionPicker } from "@/components/sports/sport-suggestion-picker";
import {
  MARTIAL_ARTS_DISCIPLINE_SUGGESTIONS,
  type MartialArtsDisciplineSuggestion,
} from "@/lib/martial-arts-catalog";
import { cn } from "@/lib/utils";

type SportManagerProps = {
  initialSports: SportDto[];
};

type SportStatsDto = NonNullable<SportDto["stats"]>;

const EMPTY_STATS: SportStatsDto = {
  activeGroups: 0,
  activePlans: 0,
  activeSubscriptions: 0,
  coaches: 0,
  activeOffers: 0,
};

function withStats(sport: SportDto): SportDto {
  return {
    ...sport,
    stats: {
      ...EMPTY_STATS,
      ...(sport.stats ?? {}),
    },
  };
}

function getMissingSetup(sport: SportDto) {
  const stats = sport.stats ?? EMPTY_STATS;
  const missing: string[] = [];
  if (stats.activeGroups === 0) missing.push("cours");
  if (stats.activePlans === 0) missing.push("formule");
  if (stats.coaches === 0) missing.push("coach");
  return missing;
}

function completionState(sport: SportDto) {
  if (!sport.isActive) {
    return {
      label: "Inactive",
      detail: "Masquée des nouveaux flux.",
      variant: "muted" as const,
    };
  }

  const missing = getMissingSetup(sport);

  if (missing.length === 0) {
    return {
      label: "Prête",
      detail: "Cours, formule et coach configurés.",
      variant: "success" as const,
    };
  }

  return {
    label: "À compléter",
    detail: `Manque: ${missing.join(", ")}.`,
    variant: "warning" as const,
  };
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count > 1 ? pluralLabel : singular}`;
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--success)]/30 bg-[var(--success-surface)]/55 text-[var(--success)]"
      : tone === "warning"
        ? "border-[var(--warning)]/35 bg-[var(--warning-surface)]/65 text-[var(--warning)]"
        : tone === "muted"
          ? "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
          : "border-[var(--primary)]/20 bg-[var(--primary)]/5 text-[var(--primary)]";

  return (
    <div className={cn("rounded-lg border px-3.5 py-3 shadow-[var(--shadow-panel)]", toneClass)}>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function DisciplineStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-soft)] px-3 py-2">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-base font-bold text-[var(--foreground)]">
        {value}
        {hint ? <span className="ml-1 text-xs font-medium text-[var(--muted-foreground)]">{hint}</span> : null}
      </p>
    </div>
  );
}

export function SportManager({ initialSports }: SportManagerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sports, setSports] = useState<SportDto[]>(initialSports.map(withStats));
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [blockedSport, setBlockedSport] = useState<null | {
    name: string;
    groups: Array<{ id: string; name: string }>;
    plans: Array<{ id: string; name: string }>;
    subscriptions: Array<{ id: string; label: string }>;
  }>(null);
  const [pendingDeleteSport, setPendingDeleteSport] = useState<SportDto | null>(null);

  async function reloadSports(query?: string) {
    const params = new URLSearchParams();
    if (query && query.trim().length > 0) {
      params.set("q", query.trim());
    }
    const endpoint = params.toString() ? `/api/sports?${params.toString()}` : "/api/sports";
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    setSports((result.data ?? []).map(withStats));
  }

  const overview = useMemo(() => {
    const activeCount = sports.filter((sport) => sport.isActive).length;
    const inactiveCount = sports.length - activeCount;
    const incompleteCount = sports.filter((sport) => sport.isActive && getMissingSetup(sport).length > 0).length;

    return {
      total: sports.length,
      active: activeCount,
      inactive: inactiveCount,
      incomplete: incompleteCount,
    };
  }, [sports]);

  const filteredSports = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    if (!query) return sports;
    return sports.filter(
      (sport) =>
        sport.name.toLocaleLowerCase("fr").includes(query) ||
        (sport.description?.toLocaleLowerCase("fr").includes(query) ?? false),
    );
  }, [searchTerm, sports]);

  const disciplineSuggestions = useMemo(() => {
    const existingNames = new Set(sports.map((sport) => sport.name.trim().toLocaleLowerCase("fr")));
    return MARTIAL_ARTS_DISCIPLINE_SUGGESTIONS.filter(
      (suggestion) => !existingNames.has(suggestion.name.toLocaleLowerCase("fr")),
    );
  }, [sports]);

  const pagination = usePagination(filteredSports, 12, searchTerm);

  function applyDisciplineSuggestion(suggestion: MartialArtsDisciplineSuggestion) {
    setName(suggestion.name);
    setDescription(suggestion.description);
    setMessage(null);
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
      setMessage(result.error ?? "Erreur lors de la création de la discipline");
      setLoading(false);
      return;
    }

    setMessage("Discipline créée avec succès");
    setName("");
    setDescription("");
    setCreateOpen(false);
    await reloadSports();
    setLoading(false);
  }

  function startEdit(sport: SportDto) {
    setEditingId(sport.id);
    setEditName(sport.name);
    setEditDescription(sport.description ?? "");
    setEditIsActive(sport.isActive);
    setOpenMenuId(null);
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
      setMessage(result.error ?? "Erreur lors de la modification de la discipline");
      setActionLoadingId(null);
      return;
    }

    setMessage("Discipline modifiée avec succès");
    cancelEdit();
    await reloadSports();
    setActionLoadingId(null);
  }

  async function toggleSportActive(sport: SportDto) {
    setActionLoadingId(sport.id);
    setOpenMenuId(null);
    setMessage(null);

    const response = await fetch("/api/sports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sportId: sport.id,
        payload: {
          isActive: !sport.isActive,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du changement de statut");
      setActionLoadingId(null);
      return;
    }

    setMessage(sport.isActive ? "Discipline désactivée" : "Discipline réactivée");
    if (editingId === sport.id) {
      cancelEdit();
    }
    await reloadSports();
    setActionLoadingId(null);
  }

  async function deleteSport(sportId: string) {
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
        setPendingDeleteSport(null);
        const sportName = sports.find((item) => item.id === sportId)?.name ?? "Discipline";
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
      setMessage(result.error ?? "Erreur lors de la desactivation de la discipline");
      setActionLoadingId(null);
      return;
    }

    setMessage("Discipline desactivee avec succes");
    setPendingDeleteSport(null);
    if (editingId === sportId) {
      cancelEdit();
    }
    await reloadSports();
    setActionLoadingId(null);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Résumé des disciplines">
        <SummaryMetric label="Disciplines" value={overview.total} />
        <SummaryMetric label="Actives" value={overview.active} tone="success" />
        <SummaryMetric label="À compléter" value={overview.incomplete} tone={overview.incomplete > 0 ? "warning" : "muted"} />
        <SummaryMetric label="Inactives" value={overview.inactive} tone="muted" />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Catalogue</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Disciplines du club</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Configurez ce qui structure les cours, formules, coachs et abonnements.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:w-[34rem]">
            <ListSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher une discipline..."
              className="sm:flex-1"
            />
            <button
              type="button"
              onClick={() => setCreateOpen((open) => !open)}
              className="btn btn-primary btn-block-mobile shrink-0"
              aria-expanded={createOpen}
              aria-controls="sport-create"
            >
              {createOpen ? <X className="size-4" /> : <Plus className="size-4" />}
              {createOpen ? "Fermer" : "Créer une discipline"}
            </button>
          </div>
        </div>

        {createOpen ? (
          <div id="sport-create" className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
            <SportSuggestionPicker
              suggestions={disciplineSuggestions}
              selectedName={name}
              onSelect={applyDisciplineSuggestion}
            />

            <form
              onSubmit={onSubmit}
              className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.2fr)_auto] lg:items-end"
            >
            <FormField label="Nom de la discipline" htmlFor="sport-name">
              <input
                id="sport-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex. Karaté"
                className="field"
                required
              />
            </FormField>
            <FormField label="Description" htmlFor="sport-description" hint="Optionnelle">
              <input
                id="sport-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Public, niveau ou particularités..."
                className="field"
              />
            </FormField>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile lg:mb-0.5">
              {loading ? "Enregistrement..." : "Créer"}
            </button>
            </form>
          </div>
        ) : null}

        <FeedbackMessage message={message} className="mt-4" />
      </section>

      <section aria-label="Liste des disciplines">
        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {pagination.pageItems.map((sport) => {
            const state = completionState(sport);
            const stats = sport.stats ?? EMPTY_STATS;
            const menuOpen = openMenuId === sport.id;
            const editing = editingId === sport.id;
            const actionBusy = actionLoadingId === sport.id;

            return (
              <li
                key={sport.id}
                className={cn(
                  "relative overflow-visible rounded-lg border bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] transition hover:border-[var(--primary)]/30 hover:shadow-[var(--shadow-floating)] sm:p-4",
                  !sport.isActive && "bg-[var(--surface-soft)]/65",
                )}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                      <Dumbbell className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-[var(--foreground)]">{sport.name}</h3>
                        <StatusBadge variant={sport.isActive ? "success" : "muted"}>
                          {sport.isActive ? "Actif" : "Inactif"}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                        {sport.description?.trim() || "Aucune description."}
                      </p>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(menuOpen ? null : sport.id)}
                      className="btn btn-ghost btn-sm min-w-9 px-2"
                      aria-label={`Actions pour ${sport.name}`}
                      aria-expanded={menuOpen}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menuOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-floating)]">
                        <button
                          type="button"
                          onClick={() => toggleSportActive(sport)}
                          disabled={actionBusy}
                          className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
                        >
                          {sport.isActive ? "Désactiver" : "Réactiver"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteSport(sport);
                            setOpenMenuId(null);
                          }}
                          disabled={actionBusy}
                          className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
                        >
                          Desactiver...
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-soft)]/65 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
                    <p className="text-xs text-[var(--muted-foreground)]">{state.detail}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <DisciplineStat label="Cours" value={stats.activeGroups} />
                  <DisciplineStat label="Formules" value={stats.activePlans} />
                  <DisciplineStat label="Coachs" value={stats.coaches} />
                  <DisciplineStat label="Abonnements" value={stats.activeSubscriptions} hint="actifs" />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {plural(stats.activeOffers, "offre")} active{stats.activeOffers > 1 ? "s" : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => (editing ? cancelEdit() : startEdit(sport))}
                    disabled={actionBusy}
                    className={cn("btn btn-sm btn-block-mobile sm:w-auto", editing ? "btn-ghost" : "btn-primary")}
                  >
                    {editing ? <X className="size-3.5" /> : <Settings2 className="size-3.5" />}
                    {editing ? "Fermer" : "Configurer"}
                  </button>
                </div>

                {editing ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveEdit(sport.id);
                    }}
                    className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
                  >
                    <FormField label="Nom" htmlFor={`sport-edit-name-${sport.id}`}>
                      <input
                        id={`sport-edit-name-${sport.id}`}
                        aria-label="Nom de la discipline"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        placeholder="Nom de la discipline"
                        className="field text-sm"
                        required
                      />
                    </FormField>
                    <FormField label="Description" htmlFor={`sport-edit-description-${sport.id}`} hint="Optionnelle">
                      <textarea
                        id={`sport-edit-description-${sport.id}`}
                        aria-label="Description de la discipline"
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        placeholder="Public, niveau ou particularités..."
                        className="field text-sm"
                        rows={2}
                      />
                    </FormField>
                    <label className="flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(event) => setEditIsActive(event.target.checked)}
                      />
                      Discipline active
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button type="button" onClick={cancelEdit} disabled={actionBusy} className="btn btn-ghost btn-block-mobile">
                        Annuler
                      </button>
                      <button type="submit" disabled={actionBusy} className="btn btn-primary btn-block-mobile">
                        <CheckCircle2 className="size-4" />
                        {actionBusy ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>

        {filteredSports.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="size-8 opacity-45" />}
            title={sports.length === 0 ? "Aucune discipline" : "Aucun résultat"}
            message={
              sports.length === 0
                ? "Créez la première discipline proposée par le club."
                : "Essayez un autre nom ou effacez la recherche."
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
        ) : null}

        <Pagination
          currentPage={pagination.currentPage}
          pageCount={pagination.pageCount}
          totalItems={filteredSports.length}
          pageSize={12}
          onPageChange={pagination.setPage}
        />
      </section>

      {blockedSport ? (
        <div className="mobile-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/40">
          <div className="mobile-modal-panel border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-floating)] md:rounded-lg">
            <h3 className="text-base font-semibold text-[var(--foreground)]">Suppression impossible</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              La discipline <span className="font-medium text-[var(--foreground)]">{blockedSport.name}</span> est
              encore utilisée. Réaffectez les éléments liés, ou désactivez-la depuis le menu d&apos;actions.
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
              <button type="button" onClick={() => setBlockedSport(null)} className="btn btn-primary btn-block-mobile">
                Compris
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteSport !== null}
        title="Desactiver cette discipline ?"
        description={`La discipline « ${pendingDeleteSport?.name ?? ""} » sera retiree des nouvelles configurations sans effacer l'historique.`}
        confirmLabel="Desactiver la discipline"
        loading={actionLoadingId === pendingDeleteSport?.id}
        onCancel={() => setPendingDeleteSport(null)}
        onConfirm={() => (pendingDeleteSport ? deleteSport(pendingDeleteSport.id) : undefined)}
      />
    </div>
  );
}
