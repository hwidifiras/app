import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormSection } from "@/components/ui/form-layout";
import { CLUB_DAY_LABELS, CLUB_DAY_SHORT_LABELS, WORKING_DAY_ORDER, type ClubDay } from "@/lib/club-working-days";
import { cn } from "@/lib/utils";

type ClubPlanningRulesSectionProps = {
  workingDays: ClubDay[];
  allowSameRoomConcurrentGroups: boolean;
  allowCoachConcurrentSameRoomQualified: boolean;
  onToggleWorkingDay: (day: ClubDay, checked: boolean) => void;
  onAllowSameRoomConcurrentGroupsChange: (checked: boolean) => void;
  onAllowCoachConcurrentSameRoomQualifiedChange: (checked: boolean) => void;
};

export function ClubPlanningRulesSection({
  workingDays,
  allowSameRoomConcurrentGroups,
  allowCoachConcurrentSameRoomQualified,
  onToggleWorkingDay,
  onAllowSameRoomConcurrentGroupsChange,
  onAllowCoachConcurrentSameRoomQualifiedChange,
}: ClubPlanningRulesSectionProps) {
  return (
    <FormSection
      id="club-planning"
      title="Planning & conflits"
      description="Choisissez quand le planning doit accepter des chevauchements volontaires."
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border/80 bg-[var(--surface-soft)]/60 p-3.5 shadow-[var(--shadow-panel)] sm:p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Jours d&apos;ouverture du club</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Les jours fermés sans séance sont masqués du planning. Une séance exceptionnelle reste visible.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {workingDays.length} jour{workingDays.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WORKING_DAY_ORDER.map((day) => {
              const checked = workingDays.includes(day);
              return (
                <label
                  key={day}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                    checked
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-border bg-[var(--surface)] text-muted-foreground hover:border-primary/25 hover:text-foreground",
                  )}
                  title={CLUB_DAY_LABELS[day]}
                >
                  <span>{CLUB_DAY_SHORT_LABELS[day]}</span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={checked}
                    onChange={(event) => onToggleWorkingDay(day, event.target.checked)}
                  />
                </label>
              );
            })}
          </div>
        </div>
        <SettingsToggleRow
          id="allowSameRoomConcurrentGroups"
          label="Deux groupes dans la même salle"
          description="Si activé, deux groupes différents peuvent avoir cours dans la même salle au même horaire sans conflit de salle."
          checked={allowSameRoomConcurrentGroups}
          onChange={onAllowSameRoomConcurrentGroupsChange}
        />
        <SettingsToggleRow
          id="allowCoachConcurrentSameRoomQualified"
          label="Coach multi-groupes dans la même salle"
          description="Si activé, un coach peut encadrer deux groupes au même horaire quand ils sont dans la même salle et que les disciplines font partie de ses spécialités."
          checked={allowCoachConcurrentSameRoomQualified}
          onChange={onAllowCoachConcurrentSameRoomQualifiedChange}
        />
      </div>
    </FormSection>
  );
}
