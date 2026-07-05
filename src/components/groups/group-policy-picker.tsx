import { cn } from "@/lib/utils";
import {
  groupGenderPolicyLabel,
  groupTypeLabel,
  type GroupGenderPolicyValue,
  type GroupTypeValue,
} from "@/lib/demographics";

const AGE_POLICY_OPTIONS: Array<{
  value: GroupTypeValue;
  title: string;
  description: string;
}> = [
  {
    value: "ADULTS",
    title: "Adultes",
    description: "Réserve ce cours aux élèves adultes.",
  },
  {
    value: "KIDS",
    title: "Enfants",
    description: "Réserve ce cours aux enfants avec contact parent.",
  },
  {
    value: "MIXED",
    title: "Mixte âge",
    description: "Accepte adultes et enfants dans le même cours.",
  },
];

const GENDER_POLICY_OPTIONS: Array<{
  value: GroupGenderPolicyValue;
  title: string;
  description: string;
}> = [
  {
    value: "MIXED",
    title: "Mixte",
    description: "Accepte filles/femmes et garçons/hommes.",
  },
  {
    value: "MALE_ONLY",
    title: "Garçons / hommes",
    description: "Filtre les inscriptions sur ce public.",
  },
  {
    value: "FEMALE_ONLY",
    title: "Filles / femmes",
    description: "Filtre les inscriptions sur ce public.",
  },
];

export function GroupPolicyPicker({
  groupType,
  genderPolicy,
  onGroupTypeChange,
  onGenderPolicyChange,
}: {
  groupType: GroupTypeValue;
  genderPolicy: GroupGenderPolicyValue;
  onGroupTypeChange: (value: GroupTypeValue) => void;
  onGenderPolicyChange: (value: GroupGenderPolicyValue) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 sm:p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Public du cours</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Ces choix filtrent les membres compatibles à l&apos;inscription et dans l&apos;affectation groupe.
        </p>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--foreground)]">Âge</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {AGE_POLICY_OPTIONS.map((option) => (
            <PolicyButton
              key={option.value}
              active={groupType === option.value}
              title={option.title}
              description={option.description}
              onClick={() => onGroupTypeChange(option.value)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--foreground)]">Genre</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {GENDER_POLICY_OPTIONS.map((option) => (
            <PolicyButton
              key={option.value}
              active={genderPolicy === option.value}
              title={option.title}
              description={option.description}
              onClick={() => onGenderPolicyChange(option.value)}
            />
          ))}
        </div>
      </fieldset>

      <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
        Résultat: cours {groupTypeLabel(groupType)} · {groupGenderPolicyLabel(genderPolicy)}.
      </p>
    </div>
  );
}

function PolicyButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-24 rounded-lg border bg-white p-3 text-left shadow-[var(--shadow-panel)] transition",
        active
          ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/15"
          : "border-[var(--border)] hover:border-[var(--primary)]/40",
      )}
      aria-pressed={active}
    >
      <span className="block text-sm font-bold text-[var(--foreground)]">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{description}</span>
    </button>
  );
}
