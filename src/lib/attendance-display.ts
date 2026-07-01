export function isLikelyInternalId(value: string | null | undefined) {
  return Boolean(
    value &&
      !value.includes("@") &&
      (/^[a-z0-9]{20,}$/i.test(value) || /^audit-[a-z0-9-]+$/i.test(value)),
  );
}

export function formatAttendanceOperator(
  value: string | null | undefined,
  userNamesById?: Map<string, string>,
) {
  if (!value) return "Système";
  const userName = userNamesById?.get(value);
  if (userName) return userName;
  return isLikelyInternalId(value) ? "Utilisateur" : value;
}
