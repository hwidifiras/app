export type MemberTypeValue = "ADULT" | "KID" | "NOT_SPECIFIED";
export type GenderValue = "MALE" | "FEMALE" | "NOT_SPECIFIED";
export type GroupTypeValue = "KIDS" | "ADULTS" | "MIXED";
export type GroupGenderPolicyValue = "MALE_ONLY" | "FEMALE_ONLY" | "MIXED";

export type GroupCompatibilityInput = {
  groupType: GroupTypeValue;
  genderPolicy?: GroupGenderPolicyValue | null;
  memberType: MemberTypeValue;
  gender?: GenderValue | null;
};

export type GroupCompatibilityResult =
  | { ok: true }
  | { ok: false; code: "AGE_POLICY_MISMATCH" | "GENDER_POLICY_MISMATCH"; message: string };

export function memberTypeLabel(value: MemberTypeValue) {
  if (value === "KID") return "enfant";
  if (value === "ADULT") return "adulte";
  return "non precise";
}

export function genderLabel(value: GenderValue) {
  if (value === "MALE") return "garcon / homme";
  if (value === "FEMALE") return "fille / femme";
  return "non precise";
}

export function groupTypeLabel(value: GroupTypeValue) {
  if (value === "KIDS") return "enfants";
  if (value === "ADULTS") return "adultes";
  return "mixte age";
}

export function groupGenderPolicyLabel(value: GroupGenderPolicyValue) {
  if (value === "MALE_ONLY") return "garcons / hommes";
  if (value === "FEMALE_ONLY") return "filles / femmes";
  return "mixte genre";
}

export function checkGroupMemberCompatibility(input: GroupCompatibilityInput): GroupCompatibilityResult {
  if (input.groupType === "KIDS" && input.memberType === "ADULT") {
    return {
      ok: false,
      code: "AGE_POLICY_MISMATCH",
      message: "Ce cours est reserve aux enfants.",
    };
  }

  if (input.groupType === "ADULTS" && input.memberType === "KID") {
    return {
      ok: false,
      code: "AGE_POLICY_MISMATCH",
      message: "Ce cours est reserve aux adultes.",
    };
  }

  const genderPolicy = input.genderPolicy ?? "MIXED";
  const memberGender = input.gender ?? "NOT_SPECIFIED";

  if (genderPolicy === "MALE_ONLY" && memberGender === "FEMALE") {
    return {
      ok: false,
      code: "GENDER_POLICY_MISMATCH",
      message: "Ce cours est reserve aux garcons / hommes.",
    };
  }

  if (genderPolicy === "FEMALE_ONLY" && memberGender === "MALE") {
    return {
      ok: false,
      code: "GENDER_POLICY_MISMATCH",
      message: "Ce cours est reserve aux filles / femmes.",
    };
  }

  return { ok: true };
}

export function isMemberAllowedInGroupPolicy(input: GroupCompatibilityInput) {
  return checkGroupMemberCompatibility(input).ok;
}
