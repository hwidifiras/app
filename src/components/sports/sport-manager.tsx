"use client";

import { FormEvent, useMemo, useState } from "react";
import { Dumbbell, Plus, X } from "lucide-react";

import { SportDto } from "@/types/sport";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { NoticeDialog } from "@/components/ui/notice-dialog";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SportSuggestionPicker } from "@/components/sports/sport-suggestion-picker";
import { SportCard } from "@/components/sports/sport-card";
import { getMissingSetup, withStats } from "@/components/sports/sport-manager-model";
import {
  MARTIAL_ARTS_DISCIPLINE_SUGGESTIONS,
  type MartialArtsDisciplineSuggestion,
} from "@/lib/martial-arts-catalog";
import { cn } from "@/lib/utils";

type SportManagerProps = {
  initialSports: SportDto[];
};

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
            const menuOpen = openMenuId === sport.id;
            const editing = editingId === sport.id;
            const actionBusy = actionLoadingId === sport.id;

            return (
              <SportCard
                key={sport.id}
                sport={sport}
                menuOpen={menuOpen}
                editing={editing}
                actionBusy={actionBusy}
                editName={editName}
                editDescription={editDescription}
                editIsActive={editIsActive}
                onToggleMenu={() => setOpenMenuId(menuOpen ? null : sport.id)}
                onToggleActive={() => { void toggleSportActive(sport); }}
                onQueueDelete={() => {
                  setPendingDeleteSport(sport);
                  setOpenMenuId(null);
                }}
                onStartEdit={() => startEdit(sport)}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => { void saveEdit(sport.id); }}
                onEditNameChange={setEditName}
                onEditDescriptionChange={setEditDescription}
                onEditIsActiveChange={setEditIsActive}
              />
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
        <NoticeDialog
          open
          title="Suppression impossible"
          onClose={() => setBlockedSport(null)}
          description={
            <>
              La discipline <span className="font-medium text-[var(--foreground)]">{blockedSport.name}</span> est
              encore utilisée. Réaffectez les éléments liés, ou désactivez-la depuis le menu d&apos;actions.
            </>
          }
        >
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
        </NoticeDialog>
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
