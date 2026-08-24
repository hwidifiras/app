"use client";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-layout";
import {
  checkGroupMemberCompatibility,
  genderLabel,
  groupGenderPolicyLabel,
  groupTypeLabel,
  memberTypeLabel,
} from "@/lib/demographics";
import { formatMoney } from "@/lib/money";
import {
  isGroupCompatibleWithLine,
  lineMemberProfile,
  type GroupOption,
  type LineState,
  type MemberOption,
  type PlanOption,
} from "@/components/enrollment/enrollment-types";

type EnrollmentLineEditorProps = {
  line: LineState;
  members: MemberOption[];
  groups: GroupOption[];
  plans: PlanOption[];
  lineIssue?: string | null;
  onChange: (line: LineState) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function EnrollmentLineEditor({
  line,
  members,
  groups,
  plans,
  lineIssue,
  onChange,
  onRemove,
  canRemove,
}: EnrollmentLineEditorProps) {
  const memberProfile = lineMemberProfile(line, members);
  const profileLabel = memberProfile
    ? `${memberTypeLabel(memberProfile.memberType)} · ${genderLabel(memberProfile.gender)}`
    : "Profil à choisir";
  const selectedGroup = groups.find((group) => group.id === line.groupId);
  const selectedCompatibility =
    selectedGroup && memberProfile
      ? checkGroupMemberCompatibility({
          groupType: selectedGroup.groupType,
          genderPolicy: selectedGroup.genderPolicy,
          memberType: memberProfile.memberType,
          gender: memberProfile.gender,
        })
      : null;
  const compatibleGroups = memberProfile
    ? groups.filter((group) => isGroupCompatibleWithLine(line, members, group))
    : groups;
  const incompatibleGroups = memberProfile
    ? groups.filter((group) => !isGroupCompatibleWithLine(line, members, group))
    : [];
  const suggestedGroups = compatibleGroups.filter((group) => group.id !== line.groupId).slice(0, 4);
  const existingProfileIncomplete =
    line.mode === "existing" &&
    memberProfile !== null &&
    (memberProfile.memberType === "NOT_SPECIFIED" || memberProfile.gender === "NOT_SPECIFIED");

  return (
    <div className="space-y-3">
      <fieldset className="grid grid-cols-2 gap-2 text-sm">
        <legend className="sr-only">Type de dossier membre</legend>
        <label className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] ${line.mode === "existing" ? "enrollment-mode-active" : "enrollment-mode-inactive"}`}>
          <input
            type="radio"
            name={`${line.key}-mode`}
            className="sr-only"
            checked={line.mode === "existing"}
            onChange={() => onChange({ ...line, mode: "existing", groupId: "", planId: "" })}
          />
          Existant
        </label>
        <label className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] ${line.mode === "new" ? "enrollment-mode-active" : "enrollment-mode-inactive"}`}>
          <input
            type="radio"
            name={`${line.key}-mode`}
            className="sr-only"
            checked={line.mode === "new"}
            onChange={() => onChange({ ...line, mode: "new", groupId: "", planId: "" })}
          />
          Nouveau
        </label>
      </fieldset>
      {line.mode === "existing" ? (
        <FormField label="Membre existant" htmlFor={`${line.key}-member`}>
          <select
            id={`${line.key}-member`}
            className="field"
            value={line.memberId}
            required
            onChange={(event) => onChange({ ...line, memberId: event.target.value, groupId: "", planId: "" })}
          >
            <option value="">Sélectionner un membre</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName} — {member.phone}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <FormField label="Prénom" htmlFor={`${line.key}-first-name`}>
            <input
              id={`${line.key}-first-name`}
              className="field"
              value={line.newFirstName}
              onChange={(event) => onChange({ ...line, newFirstName: event.target.value })}
            />
          </FormField>
          <FormField label="Nom" htmlFor={`${line.key}-last-name`}>
            <input
              id={`${line.key}-last-name`}
              className="field"
              value={line.newLastName}
              onChange={(event) => onChange({ ...line, newLastName: event.target.value })}
            />
          </FormField>
          <FormField label="Téléphone" htmlFor={`${line.key}-phone`}>
            <input
              id={`${line.key}-phone`}
              className="field"
              inputMode="tel"
              value={line.newPhone}
              onChange={(event) => onChange({ ...line, newPhone: event.target.value })}
            />
          </FormField>
          <fieldset className="sm:col-span-3">
            <legend className="mb-1 text-xs font-semibold text-[var(--foreground)]">Public</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "ADULT", label: "Adulte", hint: "Téléphone de l'élève requis" },
                { value: "KID", label: "Enfant", hint: "Parent obligatoire" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] ${
                    line.memberType === option.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${line.key}-type`}
                    value={option.value}
                    checked={line.memberType === option.value}
                    onChange={() => onChange({
                      ...line,
                      memberType: option.value as LineState["memberType"],
                      groupId: "",
                      planId: "",
                    })}
                    required
                  />
                  <span>
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block text-xs text-[var(--muted-foreground)]">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-3">
            <legend className="mb-1 text-xs font-semibold text-[var(--foreground)]">Genre</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "MALE", label: "Garcon / homme" },
                { value: "FEMALE", label: "Fille / femme" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] ${
                    line.gender === option.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${line.key}-gender`}
                    value={option.value}
                    checked={line.gender === option.value}
                    onChange={() => onChange({
                      ...line,
                      gender: option.value as LineState["gender"],
                      groupId: "",
                      planId: "",
                    })}
                    required
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          {line.memberType === "KID" && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Informations parent / tuteur
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField label="Nom du parent" htmlFor={`${line.key}-parent-name`}>
                  <input
                    id={`${line.key}-parent-name`}
                    className="field"
                    value={line.parentName}
                    onChange={(event) => onChange({ ...line, parentName: event.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Téléphone du parent" htmlFor={`${line.key}-parent-phone`}>
                  <input
                    id={`${line.key}-parent-phone`}
                    className="field"
                    inputMode="tel"
                    value={line.parentPhone}
                    onChange={(event) => onChange({ ...line, parentPhone: event.target.value })}
                    required
                  />
                </FormField>
                <FormField
                  label="Adresse du parent"
                  htmlFor={`${line.key}-parent-address`}
                  hint="Optionnelle"
                  className="sm:col-span-2"
                >
                  <input
                    id={`${line.key}-parent-address`}
                    className="field"
                    value={line.parentAddress}
                    onChange={(event) => onChange({ ...line, parentAddress: event.target.value })}
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>
      )}
      <FormField label="Groupe" htmlFor={`${line.key}-group`}>
        <select
          id={`${line.key}-group`}
          className="field"
          value={line.groupId}
          required
          aria-describedby={`${line.key}-profile`}
          onChange={(event) => onChange({ ...line, groupId: event.target.value, planId: "" })}
        >
          <option value="">Sélectionner un groupe</option>
          {memberProfile ? (
            <>
              <optgroup label={`Groupes compatibles (${compatibleGroups.length})`}>
                {compatibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} — {group.sportName} · {groupTypeLabel(group.groupType)} · {groupGenderPolicyLabel(group.genderPolicy)} ({group.activeMembers}/{group.capacity})
                  </option>
                ))}
              </optgroup>
              {incompatibleGroups.length > 0 ? (
                <optgroup label={`À vérifier / incompatibles (${incompatibleGroups.length})`}>
                  {incompatibleGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} — {group.sportName} · {groupTypeLabel(group.groupType)} · {groupGenderPolicyLabel(group.genderPolicy)} ({group.activeMembers}/{group.capacity})
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </>
          ) : (
            groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} — {group.sportName} · {groupTypeLabel(group.groupType)} ({group.activeMembers}/{group.capacity})
              </option>
            ))
          )}
        </select>
      </FormField>
      <div id={`${line.key}-profile`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[var(--foreground)]">Profil élève: {profileLabel}</p>
          <p className="text-[var(--muted-foreground)]">
            {compatibleGroups.length} groupe{compatibleGroups.length > 1 ? "s" : ""} compatible
            {compatibleGroups.length > 1 ? "s" : ""}
          </p>
        </div>
        {existingProfileIncomplete ? (
          <p className="mt-1 text-amber-700">
            Profil incomplet sur la fiche membre: complétez adulte/enfant et genre pour fiabiliser les règles groupe.
          </p>
        ) : null}
        {selectedGroup && selectedCompatibility?.ok ? (
          <p className="mt-1 text-[var(--success)]">
            Groupe compatible: {groupTypeLabel(selectedGroup.groupType)} · {groupGenderPolicyLabel(selectedGroup.genderPolicy)}.
          </p>
        ) : selectedGroup && selectedCompatibility && !selectedCompatibility.ok ? (
          <p className="mt-1 font-medium text-[var(--danger)]">
            {selectedCompatibility.message} Choisissez un groupe compatible avant de continuer.
          </p>
        ) : null}
      </div>
      {lineIssue ? <FeedbackMessage variant="error" message={lineIssue} /> : null}
      {lineIssue && suggestedGroups.length > 0 ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-bold">Suggestions compatibles</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="min-h-11 rounded-lg border border-blue-200 bg-white px-3 py-2 font-semibold text-blue-800 hover:border-blue-400"
                onClick={() => onChange({ ...line, groupId: group.id, planId: "" })}
              >
                {group.name} · {group.sportName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <FormField label="Formule" htmlFor={`${line.key}-plan`}>
        <select
          id={`${line.key}-plan`}
          className="field"
          value={line.planId}
          onChange={(event) => onChange({ ...line, planId: event.target.value })}
          disabled={!line.groupId}
          required
        >
          <option value="">Sélectionner une formule</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {formatMoney(plan.price)}
            </option>
          ))}
        </select>
      </FormField>
      {canRemove && (
        <button type="button" className="btn btn-ghost btn-block-mobile min-h-11 text-red-600 sm:w-auto" onClick={onRemove}>
          Retirer cette ligne
        </button>
      )}
    </div>
  );
}
