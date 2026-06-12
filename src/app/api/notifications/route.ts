import { NextResponse } from "next/server";
import { z } from "zod";

import { getClubSettings } from "@/lib/club-settings";
import { buildNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse } from "@/lib/permissions";
import { requireAuth } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark-read"),
    key: z.string().trim().min(1).max(240),
  }),
  z.object({
    action: z.literal("mark-all-read"),
    keys: z.array(z.string().trim().min(1).max(240)).max(100),
  }),
]);

function hasAccess(role: "ADMIN" | "STAFF", permissions: string[], permission: string) {
  return role === "ADMIN" || permissions.includes(permission);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const includePayments = hasAccess(user.role, user.permissions, "payments.manage");
    const includeExpirations = hasAccess(user.role, user.permissions, "catalog.manage");

    if (!includePayments && !includeExpirations) {
      return NextResponse.json({ data: { notifications: [], unreadCount: 0 } });
    }

    const [settings, subscriptions, reads] = await Promise.all([
      getClubSettings(),
      prisma.memberSubscription.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          amount: true,
          endDate: true,
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          plan: { select: { name: true } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.notificationRead.findMany({
        where: { userId: user.id },
        select: { notificationKey: true },
      }),
    ]);

    const notifications = buildNotifications(subscriptions, {
      includePayments,
      includeExpirations,
      debtThresholdCents: settings.debtAlertThresholdCents,
      readKeys: new Set(reads.map((read) => read.notificationKey)),
    });
    const visibleNotifications = notifications.slice(0, 100);

    return NextResponse.json({
      data: {
        notifications: visibleNotifications,
        unreadCount: visibleNotifications.filter((notification) => !notification.read).length,
      },
    });
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth(request);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Action de notification invalide" }, { status: 400 });
    }

    const keys =
      parsed.data.action === "mark-read"
        ? [parsed.data.key]
        : Array.from(new Set(parsed.data.keys));

    await prisma.$transaction(
      keys.map((notificationKey) =>
        prisma.notificationRead.upsert({
          where: {
            userId_notificationKey: {
              userId: user.id,
              notificationKey,
            },
          },
          create: {
            userId: user.id,
            notificationKey,
          },
          update: {
            readAt: new Date(),
          },
        }),
      ),
    );

    return NextResponse.json({ data: { updated: keys.length } });
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }
}
