type MemberPhoneInput = {
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
  phone?: string | null;
  parentPhone?: string | null;
  firstName: string;
  lastName: string;
};

/** Resolves a unique member phone for DB storage when child phone is omitted. */
export function resolveMemberPhone(input: MemberPhoneInput): string | null {
  const direct = input.phone?.trim() ?? "";

  if (input.memberType === "KID") {
    const parent = input.parentPhone?.trim() ?? "";
    if (parent.length < 6) {
      throw new Error("PARENT_PHONE_REQUIRED");
    }

    // Parents commonly enter their own number in both fields when registering
    // siblings. Keep that shared contact on parentPhone so the member's unique
    // phone column does not reject the second child.
    const directDigits = direct.replace(/\D/g, "");
    const parentDigits = parent.replace(/\D/g, "");
    if (
      direct.length < 6 ||
      (directDigits.length >= 6 &&
        parentDigits.length >= 6 &&
        (directDigits === parentDigits ||
          directDigits.endsWith(parentDigits) ||
          parentDigits.endsWith(directDigits)))
    ) {
      return null;
    }

    return direct;
  }

  if (direct.length >= 6) {
    return direct;
  }

  throw new Error("PHONE_REQUIRED");
}
