import { offerToRulesRecord } from "@/lib/offer-rules";
import { prisma } from "@/lib/prisma";
import {
  getTenantProductContext,
  type TenantProductContext,
} from "@/platform/product/product-context";

export const ENROLLMENT_TYPES = ["class", "gym", "mixed"] as const;
export type EnrollmentType = (typeof ENROLLMENT_TYPES)[number];

export class EnrollmentContextUnavailableError extends Error {
  constructor(message = "Ce type d'inscription n'est pas actif pour ce club") {
    super(message);
    this.name = "EnrollmentContextUnavailableError";
  }
}

export function resolveEnrollmentType(
  product: TenantProductContext,
  requestedType: unknown,
): EnrollmentType {
  if (product.profile === "GYM_ONLY") return "gym";
  if (product.profile === "CLASS_ONLY") return "class";
  return requestedType === "gym" || requestedType === "mixed" ? requestedType : "class";
}

function assertEnrollmentTypeAvailable(product: TenantProductContext, type: EnrollmentType) {
  const available =
    (type === "class" && product.capabilities.classManagement) ||
    (type === "gym" && product.capabilities.gymAccess) ||
    (type === "mixed" && product.capabilities.mixedSales);
  if (!available) throw new EnrollmentContextUnavailableError();
}

export async function loadEnrollmentContext({
  tenantId,
  type,
  product: providedProduct,
}: {
  tenantId: string;
  type: EnrollmentType;
  product?: TenantProductContext;
}) {
  const product = providedProduct ?? await getTenantProductContext(tenantId);
  assertEnrollmentTypeAvailable(product, type);

  const planKind = type === "class" ? "CLASS" : type === "gym" ? "GYM" : "MIXED";
  const offerScopes = type === "class" ? ["ALL", "CLASS"] : type === "gym" ? ["ALL", "GYM"] : ["ALL", "MIXED"];
  const includeGroups = type !== "gym";

  const [members, groups, plans, offers] = await Promise.all([
    prisma.member.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        memberType: true,
        gender: true,
      },
    }),
    includeGroups
      ? prisma.group.findMany({
          where: { tenantId, isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            sportId: true,
            groupType: true,
            genderPolicy: true,
            capacity: true,
            sport: { select: { name: true } },
            _count: {
              select: {
                members: { where: { tenantId, status: "ACTIVE" } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.subscriptionPlan.findMany({
      where: { tenantId, isActive: true, planKind },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        planKind: true,
        activationPolicy: true,
        activationWindowDays: true,
        freezeAllowanceCount: true,
        freezeMaxTotalDays: true,
        price: true,
        totalSessions: true,
        sessionsPerWeek: true,
        validityDays: true,
        sportId: true,
        sport: { select: { id: true, name: true } },
        entitlements: {
          select: {
            type: true,
            grantedUnits: true,
            sessionsPerWeek: true,
            gymAccessMode: true,
            sport: { select: { id: true, name: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.offer.findMany({
      where: {
        tenantId,
        isActive: true,
        planScope: { in: offerScopes as Array<"ALL" | "CLASS" | "GYM" | "MIXED"> },
      },
      orderBy: { createdAt: "desc" },
      include: {
        sport: { select: { id: true, name: true } },
        _count: { select: { applications: true } },
      },
    }),
  ]);

  return {
    type,
    profile: product.profile,
    members,
    groups,
    plans,
    offers: offers.map((offer) => ({
      ...offer,
      sportName: offer.sport?.name ?? null,
      applicationsCount: offer._count.applications,
      rules: offerToRulesRecord(offer),
    })),
  };
}
