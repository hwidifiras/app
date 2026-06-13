import type { PermissionKey } from "@/lib/permission-definitions";

export const ROUTE_PERMISSION_RULES: Array<{ paths: string[]; permission: PermissionKey }> = [
  { paths: ["/enrollment", "/api/enrollment", "/api/group-members"], permission: "enrollment.manage" },
  { paths: ["/attendance", "/api/attendances"], permission: "attendance.manage" },
  { paths: ["/payments", "/api/payments"], permission: "payments.manage" },
  { paths: ["/offers", "/api/offers"], permission: "offers.manage" },
  {
    paths: [
      "/sports",
      "/coaches",
      "/groups",
      "/sessions",
      "/subscription-plans",
      "/subscriptions",
      "/api/sports",
      "/api/coaches",
      "/api/groups",
      "/api/sessions",
      "/api/subscription-plans",
      "/api/member-subscriptions",
    ],
    permission: "catalog.manage",
  },
  {
    paths: ["/members", "/api/members", "/api/households"],
    permission: "members.manage",
  },
];

export const ADMIN_ROUTE_PREFIXES = [
  "/settings/users",
  "/settings/club",
  "/settings/data-import",
  "/logs",
  "/api/users",
  "/api/club-settings",
  "/api/data-import",
] as const;

export function requiredPermissionForPath(pathname: string): PermissionKey | null {
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (rule.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return rule.permission;
    }
  }
  return null;
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ROUTE_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
