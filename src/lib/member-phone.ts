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
  if (direct.length >= 6) return direct;

  if (input.memberType === "KID") {
    const parent = input.parentPhone?.trim() ?? "";
    if (parent.length < 6) {
      throw new Error("PARENT_PHONE_REQUIRED");
    }
    return null;
  }

  throw new Error("PHONE_REQUIRED");
}
