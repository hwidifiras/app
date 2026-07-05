import { UsersRound } from "lucide-react";

import {
  groupGenderPolicyLabel,
  groupTypeLabel,
  type GroupGenderPolicyValue,
  type GroupTypeValue,
} from "@/lib/demographics";
import { formatRoomLabel } from "@/lib/group-room";

type GroupSetupSummaryProps = {
  name: string;
  sportName?: string | null;
  coachName?: string | null;
  room?: string | null;
  capacity: number;
  groupType: GroupTypeValue;
  genderPolicy: GroupGenderPolicyValue;
  compatibleMemberCount: number;
  selectedMemberCount: number;
  totalMemberCount: number;
  isActive?: boolean;
  coachOverrideActive?: boolean;
};

export function GroupSetupSummary({
  name,
  sportName,
  coachName,
  room,
  capacity,
  groupType,
  genderPolicy,
  compatibleMemberCount,
  selectedMemberCount,
  totalMemberCount,
  isActive = true,
  coachOverrideActive = false,
}: GroupSetupSummaryProps) {
  const resolvedName = name.trim() || "Nom du cours à définir";
  const publicLabel = `${groupTypeLabel(groupType)} · ${groupGenderPolicyLabel(genderPolicy)}`;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            Résumé du cours
          </p>
          <h2 className="mt-1 truncate text-lg font-black text-[var(--foreground)]">{resolvedName}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Ce résumé montre comment le groupe sera proposé à l&apos;inscription et utilisé dans le planning.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
            isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"
          }`}
        >
          {isActive ? "Actif" : "Inactif"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Discipline" value={sportName || "À choisir"} />
        <SummaryTile label="Public accepté" value={publicLabel} />
        <SummaryTile
          label="Coach / salle"
          value={coachName || "Coach à choisir"}
          detail={formatRoomLabel(room, "Salle par séance")}
          warning={coachOverrideActive ? "Exception hors spécialité à justifier" : undefined}
        />
        <SummaryTile
          label="Capacité"
          value={`${selectedMemberCount}/${capacity} inscrit${selectedMemberCount > 1 ? "s" : ""}`}
          detail={`${compatibleMemberCount}/${totalMemberCount} membre${totalMemberCount > 1 ? "s" : ""} compatible${compatibleMemberCount > 1 ? "s" : ""}`}
          icon={<UsersRound className="size-4 text-[var(--primary)]" />}
        />
      </div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  warning,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  warning?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 truncate text-sm font-bold text-[var(--foreground)]">{value}</p>
      {detail ? <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{detail}</p> : null}
      {warning ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{warning}</p> : null}
    </div>
  );
}
