import type { PermissionKey } from "@/lib/permission-definitions";
import type { ProductModule, ProductProfile } from "@/platform/product/product-context";

export type ProductNavigationSection = "today" | "sales" | "members" | "club" | "settings" | "administration";
export type ProductMobilePlacement = "primary" | "drawer" | "none";

export type ProductRouteDefinition = {
  id: string;
  paths: readonly string[];
  module: ProductModule | null;
  permission: PermissionKey | null;
  navigationSection: ProductNavigationSection | null;
  mobilePlacement: Partial<Record<ProductProfile, ProductMobilePlacement>>;
  setupStep: string | null;
};

export const PRODUCT_ROUTE_REGISTRY: readonly ProductRouteDefinition[] = [
  {
    id: "dashboard",
    paths: ["/"],
    module: null,
    permission: null,
    navigationSection: "today",
    mobilePlacement: { CLASS_ONLY: "primary", GYM_ONLY: "primary", HYBRID: "primary" },
    setupStep: null,
  },
  {
    id: "class-attendance",
    paths: ["/attendance", "/api/attendances"],
    module: "CLASS_MANAGEMENT",
    permission: "class.attendance",
    navigationSection: "today",
    mobilePlacement: { CLASS_ONLY: "primary", HYBRID: "primary" },
    setupStep: null,
  },
  {
    id: "class-sessions",
    paths: ["/sessions", "/api/sessions"],
    module: "CLASS_MANAGEMENT",
    permission: "class.attendance",
    navigationSection: "today",
    mobilePlacement: { CLASS_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: "group",
  },
  {
    id: "class-enrollment-assignments",
    paths: ["/api/group-members"],
    module: "CLASS_MANAGEMENT",
    permission: "enrollment.sell",
    navigationSection: null,
    mobilePlacement: {},
    setupStep: null,
  },
  {
    id: "class-catalog",
    paths: [
      "/groups",
      "/coaches",
      "/sports",
      "/api/groups",
      "/api/coaches",
      "/api/sports",
    ],
    module: "CLASS_MANAGEMENT",
    permission: "class.manage",
    navigationSection: "club",
    mobilePlacement: { CLASS_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: "sport",
  },
  {
    id: "class-schedule-settings",
    paths: ["/settings/schedules", "/api/schedule-templates"],
    module: "CLASS_MANAGEMENT",
    permission: "settings.manage",
    navigationSection: "settings",
    mobilePlacement: { CLASS_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: "group",
  },
  {
    id: "gym-check-in",
    paths: ["/gym/check-in", "/api/gym/check-in"],
    module: "GYM_ACCESS",
    permission: "gym.checkin",
    navigationSection: "today",
    mobilePlacement: { GYM_ONLY: "primary", HYBRID: "primary" },
    setupStep: null,
  },
  {
    id: "gym-management",
    paths: [
      "/gym/visits",
      "/gym/import",
      "/api/gym/visits",
      "/api/gym/credentials",
      "/api/gym/import",
      "/api/gym/reports",
    ],
    module: "GYM_ACCESS",
    permission: "gym.manage",
    navigationSection: "members",
    mobilePlacement: { GYM_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: null,
  },
  {
    id: "enrollment",
    paths: ["/enrollment"],
    module: null,
    permission: "enrollment.sell",
    navigationSection: "sales",
    mobilePlacement: { CLASS_ONLY: "primary", GYM_ONLY: "primary", HYBRID: "primary" },
    setupStep: "plan",
  },
  {
    id: "enrollment-context",
    paths: ["/api/enrollment/context"],
    module: null,
    permission: "enrollment.sell",
    navigationSection: null,
    mobilePlacement: {},
    setupStep: "plan",
  },
  {
    id: "class-enrollment",
    paths: ["/api/enrollment"],
    module: "CLASS_MANAGEMENT",
    permission: "enrollment.sell",
    navigationSection: null,
    mobilePlacement: {},
    setupStep: "plan",
  },
  {
    id: "payment-collection",
    paths: ["/payments/new"],
    module: null,
    permission: "payments.collect",
    navigationSection: "sales",
    mobilePlacement: { CLASS_ONLY: "primary", GYM_ONLY: "primary", HYBRID: "primary" },
    setupStep: null,
  },
  {
    id: "payments",
    paths: ["/payments", "/receipts", "/api/payments", "/api/receipts"],
    module: null,
    permission: "reports.finance",
    navigationSection: "sales",
    mobilePlacement: { CLASS_ONLY: "primary", GYM_ONLY: "primary", HYBRID: "primary" },
    setupStep: null,
  },
  {
    id: "members",
    paths: ["/members", "/api/members", "/api/member-directory", "/api/households"],
    module: null,
    permission: "members.manage",
    navigationSection: "members",
    mobilePlacement: { CLASS_ONLY: "primary", GYM_ONLY: "primary", HYBRID: "drawer" },
    setupStep: "member",
  },
  {
    id: "subscriptions",
    paths: ["/subscriptions", "/api/member-subscriptions"],
    module: null,
    permission: "enrollment.sell",
    navigationSection: "sales",
    mobilePlacement: { CLASS_ONLY: "drawer", GYM_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: null,
  },
  {
    id: "plans",
    paths: ["/subscription-plans", "/api/subscription-plans"],
    module: null,
    permission: "plans.manage",
    navigationSection: "settings",
    mobilePlacement: { CLASS_ONLY: "drawer", GYM_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: "plan",
  },
  {
    id: "account-settings",
    paths: ["/settings/account"],
    module: null,
    permission: null,
    navigationSection: "settings",
    mobilePlacement: { CLASS_ONLY: "drawer", GYM_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: null,
  },
  {
    id: "class-import",
    paths: ["/settings/data-import", "/api/data-import"],
    module: "CLASS_MANAGEMENT",
    permission: "settings.manage",
    navigationSection: "settings",
    mobilePlacement: { CLASS_ONLY: "drawer", HYBRID: "drawer" },
    setupStep: null,
  },
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function productRouteForPath(pathname: string): ProductRouteDefinition | null {
  const matches = PRODUCT_ROUTE_REGISTRY.flatMap((route) =>
    route.paths
      .filter((path) => matchesPrefix(pathname, path))
      .map((path) => ({ route, pathLength: path.length })),
  );
  return matches.sort((left, right) => right.pathLength - left.pathLength)[0]?.route ?? null;
}

export function requiredProductModuleForPath(pathname: string): ProductModule | null {
  if (/^\/members\/[^/]+\/add-to-group(?:\/|$)/.test(pathname)) {
    return "CLASS_MANAGEMENT";
  }
  return productRouteForPath(pathname)?.module ?? null;
}
