import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => {
  const scope = globalThis as typeof globalThis & {
    __gymdayTestAuthState?: { token: string | null };
  };
  return (scope.__gymdayTestAuthState ??= { token: null });
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => authState.token ? { value: authState.token } : undefined }),
}));

import { POST as createSubscription } from "@/app/api/member-subscriptions/route";
import { signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseReceiptSnapshot } from "@/lib/receipts";
import { withTenantContext } from "@/lib/tenant-context";

const TENANT_ID = "tenant_access_offer_route";
const TENANT_SLUG = "access-offer-route";

function request(body: unknown) {
  return new Request(`http://${TENANT_SLUG}.localhost/api/member-subscriptions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `access-offer-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(body),
  });
}

describe("gym and mixed enrollment offers", () => {
  beforeEach(() => {
    authState.token = null;
  });

  it("persists a server-calculated gym discount in the subscription, payment and receipt", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await prisma.tenant.upsert({
      where: { slug: TENANT_SLUG },
      create: { id: TENANT_ID, slug: TENANT_SLUG, name: "Access Offer Route" },
      update: { status: "ACTIVE" },
    });

    await withTenantContext(
      { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, host: `${TENANT_SLUG}.test.local` },
      async () => {
        const actor = await prisma.user.create({
          data: {
            tenantId: TENANT_ID,
            email: `access-offer-${suffix}@example.test`,
            name: "Responsable ventes",
            passwordHash: "test",
            role: "ADMIN",
          },
        });
        authState.token = await signAuthToken({
          userId: actor.id,
          tenantId: TENANT_ID,
          tenantSlug: TENANT_SLUG,
          email: actor.email,
          name: actor.name,
          role: actor.role,
          permissions: [],
        });
        await prisma.tenantModule.upsert({
          where: { tenantId_moduleKey: { tenantId: TENANT_ID, moduleKey: "GYM_ACCESS" } },
          create: { tenantId: TENANT_ID, moduleKey: "GYM_ACCESS", status: "ENABLED", enabledAt: new Date() },
          update: { status: "ENABLED", enabledAt: new Date(), disabledAt: null },
        });
        const member = await prisma.member.create({
          data: { tenantId: TENANT_ID, firstName: "Offre", lastName: "Salle", phone: `offer-${suffix}` },
        });
        const plan = await prisma.subscriptionPlan.create({
          data: {
            tenantId: TENANT_ID,
            name: `Pass promo ${suffix}`,
            planKind: "GYM",
            price: 10_000,
            totalSessions: 0,
            validityDays: 30,
            entitlements: {
              create: {
                tenantId: TENANT_ID,
                type: "GYM_ACCESS",
                gymAccessMode: "UNLIMITED",
              },
            },
          },
        });
        const offer = await prisma.offer.create({
          data: {
            tenantId: TENANT_ID,
            name: "Promotion salle 10 %",
            kind: "PERCENT_OFF",
            planScope: "GYM",
            isActive: true,
            percentOff: 10,
            rules: JSON.stringify({ percentOff: 10 }),
            createdById: actor.id,
          },
        });

        const response = await createSubscription(request({
          memberId: member.id,
          planId: plan.id,
          offerId: offer.id,
          startDate: new Date("2026-08-15T00:00:00.000Z").toISOString(),
          paymentCents: 9_000,
          paymentMethod: "CASH",
        }));
        const payload = await response.clone().json() as { data?: { id: string }; error?: string };
        expect(response.status, JSON.stringify(payload)).toBe(201);

        const subscription = await prisma.memberSubscription.findFirstOrThrow({
          where: { id: payload.data?.id, tenantId: TENANT_ID },
          include: { payments: true, offerApplication: true },
        });
        expect(subscription).toMatchObject({
          amount: 9_000,
          listPriceCents: 10_000,
          discountCents: 1_000,
          offerName: offer.name,
        });
        expect(subscription.payments).toHaveLength(1);
        expect(subscription.payments[0].amount).toBe(9_000);
        expect(subscription.offerApplication).not.toBeNull();

        const receipt = await prisma.receipt.findFirstOrThrow({
          where: { tenantId: TENANT_ID, paymentId: subscription.payments[0].id },
        });
        expect(parseReceiptSnapshot(receipt)?.subscription).toMatchObject({
          amountCents: 9_000,
          listPriceCents: 10_000,
          discountCents: 1_000,
          offerName: offer.name,
        });
      },
    );
  });
});
