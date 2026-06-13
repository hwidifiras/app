import { NextResponse } from "next/server";
import { z } from "zod";

import { getClubSettings } from "@/lib/club-settings";
import { buildNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse } from "@/lib/permissions";
import { requireAuth } from "@/lib/request-user";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";

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
    const includeAttendance = hasAccess(user.role, user.permissions, "attendance.manage");

    if (!includePayments && !includeExpirations && !includeAttendance) {
      return NextResponse.json({ data: { notifications: [], unreadCount: 0 } });
    }

    const today = utcDateOnlyForTimeZone(new Date());
    const overdueSince = new Date(today);
    overdueSince.setUTCDate(overdueSince.getUTCDate() - 30);

    const [settings, subscriptions, sessions, reads] = await Promise.all([
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
      includeAttendance
        ? prisma.session.findMany({
            where: {
              status: { in: ["PLANNED", "RESCHEDULED"] },
              sessionDate: { gte: overdueSince, lte: today },
            },
            select: {
              id: true,
              status: true,
              sessionDate: true,
              endTime: true,
              group: {
                select: {
                  name: true,
                  members: {
                    select: { memberId: true, startDate: true, endDate: true },
                  },
                },
              },
              attendances: { select: { memberId: true } },
            },
          })
        : Promise.resolve([]),
      prisma.notificationRead.findMany({
        where: { userId: user.id },
        select: { notificationKey: true },
      }),
    ]);

    const overdueSessions = sessions.flatMap((session) => {
      const lifecycle = deriveSessionLifecycle({
        status: session.status,
        sessionDate: session.sessionDate,
        endTime: session.endTime,
        expectedMemberIds: expectedMemberIdsAtSession(session.group.members, session.sessionDate),
        attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
      });
      return lifecycle.operationalStatus === "NEEDS_FINALIZATION"
        ? [{
            id: session.id,
            groupName: session.group.name,
            sessionDate: session.sessionDate,
            endTime: session.endTime,
            unmarkedCount: lifecycle.unmarkedCount,
          }]
        : [];
    });

    const notifications = buildNotifications(subscriptions, {
      includePayments,
      includeExpirations,
      debtThresholdCents: settings.debtAlertThresholdCents,
      readKeys: new Set(reads.map((read) => read.notificationKey)),
      overdueSessions,
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
