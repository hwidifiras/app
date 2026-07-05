import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, ClipboardCheck, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatRoomLabel } from "@/lib/group-room";
import { cn } from "@/lib/utils";
import type { CoachDto } from "@/types/coach";

export function CoachSummaryMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/75"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/75"
        : tone === "muted"
          ? "border-[var(--border)] bg-[var(--surface-soft)]"
          : "border-blue-200 bg-blue-50/70";

  return (
    <div className={cn("rounded-lg border px-3.5 py-3 shadow-[var(--shadow-panel)]", toneClass)}>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs leading-snug text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

export function CoachRuleCard({
  icon: Icon,
  title,
  children,
  tone = "info",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={cn("rounded-lg border px-3.5 py-3 text-xs leading-relaxed shadow-[var(--shadow-panel)]", toneClass)}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-[var(--foreground)]">{title}</p>
          <div className="mt-1 text-[var(--muted-foreground)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function CoachSpecialtyChips({ coach }: { coach: CoachDto }) {
  if (coach.qualifiedSports.length === 0) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">
        Spécialité à compléter
      </span>
    );
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {coach.qualifiedSports.map((sport) => (
        <span
          key={sport.id}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
            sport.isPrimary ? "bg-blue-50 text-blue-700" : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
          )}
        >
          {sport.name}
          {sport.isPrimary ? <span className="ml-1 opacity-70">principal</span> : null}
        </span>
      ))}
    </span>
  );
}

export function CoachLoadSummary({ coach }: { coach: CoachDto }) {
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-3">
      <CoachLoadPill
        label="Cours actifs"
        value={coach.activeGroupCount}
        detail={coach.activeGroupCount > 0 ? "Affecté au planning" : "Non affecté"}
        tone={coach.activeGroupCount > 0 ? "success" : "muted"}
      />
      <CoachLoadPill
        label="Créneaux/semaine"
        value={coach.weeklyScheduleCount}
        detail={coach.weeklyScheduleCount > 0 ? "Horaires fixes" : "Aucun horaire"}
        tone={coach.weeklyScheduleCount > 0 ? "default" : "muted"}
      />
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
        <p className="font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Statut</p>
        <div className="mt-1">
          <StatusBadge variant={coach.isActive ? "success" : "muted"}>{coach.isActive ? "Actif" : "Inactif"}</StatusBadge>
        </div>
      </div>
    </div>
  );
}

export function CoachGroupsPreview({ coach }: { coach: CoachDto }) {
  if (coach.activeGroups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        Aucun groupe actif. Ce coach peut être choisi dans un nouveau cours si sa spécialité correspond.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {coach.activeGroups.slice(0, 3).map((group) => (
        <li key={group.id} className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-soft)] px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--foreground)]">{group.name}</span>
            <span className="block truncate text-[var(--muted-foreground)]">
              {group.sportName ?? "Discipline"} · {formatRoomLabel(group.room, "Salle par séance")}
            </span>
          </span>
        </li>
      ))}
      {coach.activeGroups.length > 3 ? (
        <li className="px-3 text-xs font-semibold text-[var(--muted-foreground)]">
          + {coach.activeGroups.length - 3} autre(s) groupe(s)
        </li>
      ) : null}
    </ul>
  );
}

function CoachLoadPill({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "default" | "success" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "muted"
        ? "border-[var(--border)] bg-[var(--surface-soft)]"
        : "border-blue-200 bg-blue-50";

  return (
    <div className={cn("rounded-md border px-3 py-2", toneClass)}>
      <p className="font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-base font-black text-[var(--foreground)]">{value}</p>
      <p className="text-[0.68rem] text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

export const coachRuleCards = [
  {
    icon: ClipboardCheck,
    title: "Spécialité principale",
    tone: "info" as const,
    text: "La spécialité principale sert de repère pour choisir rapidement le bon coach d'un cours.",
  },
  {
    icon: ShieldCheck,
    title: "Disciplines autorisées",
    tone: "success" as const,
    text: "Ajoutez plusieurs disciplines seulement si le coach peut réellement encadrer ces cours.",
  },
  {
    icon: AlertTriangle,
    title: "Conflits planning",
    tone: "warning" as const,
    text: "Le planning contrôle les chevauchements coach/salle selon les préférences du club.",
  },
] satisfies Array<{
  icon: ComponentType<{ className?: string }>;
  title: string;
  tone: "info" | "success" | "warning";
  text: string;
}>;
