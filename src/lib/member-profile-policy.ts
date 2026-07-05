import type { GenderValue, MemberTypeValue } from "@/lib/demographics";

export function memberProfileCompletionError(input: {
  memberType: MemberTypeValue;
  gender: GenderValue;
  parentName?: string | null;
  parentPhone?: string | null;
}) {
  if (input.memberType === "NOT_SPECIFIED") {
    return "Type adulte/enfant requis";
  }

  if (input.gender === "NOT_SPECIFIED") {
    return "Genre requis";
  }

  if (input.memberType === "KID") {
    if (!input.parentName?.trim()) {
      return "Nom du parent requis pour un enfant";
    }
    if ((input.parentPhone?.trim().length ?? 0) < 6) {
      return "Téléphone du parent requis pour un enfant";
    }
  }

  return null;
}
