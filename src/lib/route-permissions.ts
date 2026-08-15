import type { PermissionKey } from "@/lib/permission-definitions";
import { productRouteForPath } from "@/platform/product/product-registry";

export const ROUTE_PERMISSION_RULES: Array<{ paths: string[]; permission: PermissionKey }> = [
  { paths: ["/enrollment", "/api/enrollment", "/api/group-members"], permission: "enrollment.sell" },
  { paths: ["/attendance", "/api/attendances"], permission: "class.attendance" },
  { paths: ["/payments/new"], permission: "payments.collect" },
  { paths: ["/payments", "/receipts", "/api/payments", "/api/receipts"], permission: "reports.finance" },
  { paths: ["/offers", "/api/offers"], permission: "plans.manage" },
  { paths: ["/gym/check-in", "/api/gym/check-in"], permission: "gym.checkin" },
  { paths: ["/gym", "/api/gym"], permission: "gym.manage" },
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
    permission: "class.manage",
  },
  {
    paths: ["/members", "/api/members", "/api/households"],
    permission: "members.manage",
  },
  {
    paths: ["/settings", "/api/club-settings", "/api/schedule-templates", "/api/data-import"],
    permission: "settings.manage",
  },
];

export const ADMIN_ROUTE_PREFIXES = [
  "/settings/users",
  "/logs",
  "/api/users",
] as const;

export function requiredPermissionForPath(pathname: string): PermissionKey | null {
  const productRoute = productRouteForPath(pathname);
  if (productRoute) return productRoute.permission;

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
