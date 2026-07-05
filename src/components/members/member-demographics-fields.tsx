import type { GenderValue, MemberTypeValue } from "@/lib/demographics";

type MemberDemographicsFieldsProps = {
  memberType: MemberTypeValue;
  gender: GenderValue;
  birthDate: string;
  onMemberTypeChange: (value: MemberTypeValue) => void;
  onGenderChange: (value: GenderValue) => void;
  onBirthDateChange: (value: string) => void;
  birthDateRequired?: boolean;
};

function computeAge(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const birthdayPassed =
    now.getMonth() > parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() >= parsed.getDate());
  if (!birthdayPassed) age -= 1;
  return Math.max(0, age);
}

export function MemberDemographicsFields({
  memberType,
  gender,
  birthDate,
  onMemberTypeChange,
  onGenderChange,
  onBirthDateChange,
  birthDateRequired = false,
}: MemberDemographicsFieldsProps) {
  const age = computeAge(birthDate);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold text-[var(--foreground)]">Public *</label>
          <div className="grid gap-2" role="radiogroup" aria-label="Public du membre">
            {[
              { value: "ADULT", label: "Adulte", hint: "Téléphone élève requis" },
              { value: "KID", label: "Enfant", hint: "Parent obligatoire" },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  memberType === option.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <input
                  type="radio"
                  name="member-type"
                  value={option.value}
                  checked={memberType === option.value}
                  onChange={() => onMemberTypeChange(option.value as MemberTypeValue)}
                  required
                />
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {memberType === "NOT_SPECIFIED" ? (
            <p className="mt-1 text-xs font-medium text-[var(--warning)]">
              Choisissez adulte ou enfant pour fiabiliser les groupes et le pointage.
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">
            Date de naissance{birthDateRequired ? " *" : ""}
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => onBirthDateChange(event.target.value)}
            className="field"
            required={birthDateRequired}
          />
          {age !== null ? (
            <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">Âge estimé: {age} ans</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-[var(--foreground)]">Genre *</label>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Genre">
          {[
            { value: "MALE", label: "Garçon / homme" },
            { value: "FEMALE", label: "Fille / femme" },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                gender === option.value
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              <input
                type="radio"
                name="member-gender"
                value={option.value}
                checked={gender === option.value}
                onChange={() => onGenderChange(option.value as GenderValue)}
                required
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
