const REGISTRATION_ONLY_PAGE_PREFIXES = [
  "/enrollment",
  "/members",
  "/receipts",
  "/payments",
  "/subscriptions",
  "/sessions",
  "/groups",
  "/coaches",
  "/settings/users",
  "/settings/account",
  "/subscription-status",
] as const;

const REGISTRATION_ONLY_NAV_PATHS = new Set([
  "/enrollment",
  "/members",
  "/payments",
  "/sessions",
  "/groups",
  "/coaches",
  "/settings/users",
  "/settings/account",
]);

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function registrationOnlyPageIsAllowed(pathname: string) {
  return REGISTRATION_ONLY_PAGE_PREFIXES.some((prefix) => matchesPath(pathname, prefix));
}

export function registrationOnlyNavItemIsAllowed(href: string) {
  return REGISTRATION_ONLY_NAV_PATHS.has(href);
}
