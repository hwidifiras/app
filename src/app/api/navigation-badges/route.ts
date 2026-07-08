import { NextResponse } from "next/server";

import { getClubSettings } from "@/lib/club-settings";
import { getWeekRangeUtc, utcDateOnlyForTimeZone } from "@/lib/dates";
import { jsonAuthFailureResponse, userHasPermission } from "@/lib/permissions";
import { buildPlanningConflictDetails } from "@/lib/planning-conflicts";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/request-user";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";

export const dynamic = "force-dynamic";

const RENEWAL_WINDOW_DAYS = 7;
const LOW_SESSION_THRESHOLD = 2;

type NavigationBadgeTone = "blue" | "amber" | "red";

type NavigationBadge = {
  label: string;
  tone: NavigationBadgeTone;
};

function compactCount(count: number) {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

function badge(count: number, tone: NavigationBadgeTone): NavigationBadge | null {
  const label = compactCount(count);
  return label ? { label, tone } : null;
}

function hasRemainingBalance(subscription: { amount: number; payments: Array<{ amount: number }> }) {
  const paid = subscription.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(0, subscription.amount - paid) > 0;
}

function daysUntil(date: Date, now: Date) {
  return Math.ceil((utcDateOnlyForTimeZone(date).getTime() - utcDateOnlyForTimeZone(now).getTime()) / 86_400_000);
}

function needsRenewal(subscription: { status: string; endDate: Date | null; remainingSessions: number }, now: Date) {
  if (subscription.status !== "ACTIVE") return false;
  return (
    subscription.remainingSessions <= LOW_SESSION_THRESHOLD ||
    (subscription.endDate ? daysUntil(subscription.endDate, now) <= RENEWAL_WINDOW_DAYS : false)
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const tenantId = user.tenantId;
    const includeAttendance = await userHasPermission(user, "attendance.manage");
    const includePayments = await userHasPermission(user, "payments.manage");
    const includeCatalog = await userHasPermission(user, "catalog.manage");
    const now = new Date();
    const today = utcDateOnlyForTimeZone(now);
    const overdueSince = new Date(today);
    overdueSince.setUTCDate(overdueSince.getUTCDate() - 30);
    const { start: weekStart, end: weekEnd } = getWeekRangeUtc(now);

    const [attendanceSessions, subscriptions, planningSessions, coaches, settings] = await Promise.all([
      includeAttendance
        ? prisma.session.findMany({
            where: {
              tenantId,
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
                  members: {
                    where: { tenantId },
                    select: {
                      memberId: true,
                      status: true,
                      startDate: true,
                      endDate: true,
                      member: { select: { status: true } },
                    },
                  },
                },
              },
              attendances: { select: { memberId: true } },
            },
          })
        : Promise.resolve([]),
      includePayments || includeCatalog
        ? prisma.memberSubscription.findMany({
            where: { tenantId, status: "ACTIVE" },
            select: {
              id: true,
              amount: true,
              endDate: true,
              remainingSessions: true,
              status: true,
              payments: { select: { amount: true } },
            },
          })
        : Promise.resolve([]),
      includeCatalog
        ? prisma.session.findMany({
            where: {
              tenantId,
              sessionDate: { gte: weekStart, lt: weekEnd },
              status: { not: "CANCELLED" },
            },
            select: {
              id: true,
              sessionDate: true,
              startTime: true,
              endTime: true,
              coachId: true,
              room: true,
              status: true,
              group: { select: { name: true, sportId: true } },
              coach: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      includeCatalog
        ? prisma.coach.findMany({
            where: { tenantId, isActive: true },
            select: {
              id: true,
              sportId: true,
              qualifications: { select: { sportId: true } },
            },
          })
        : Promise.resolve([]),
      includeCatalog ? getClubSettings() : Promise.resolve(null),
    ]);

    const pointageCount = attendanceSessions.filter((session) => {
      const lifecycle = deriveSessionLifecycle({
        status: session.status,
        sessionDate: session.sessionDate,
        endTime: session.endTime,
        expectedMemberIds: expectedMemberIdsAtSession(session.group.members, session.sessionDate),
        attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
      });
      const isToday = utcDateOnlyForTimeZone(session.sessionDate).getTime() === today.getTime();
      return isToday || lifecycle.operationalStatus === "NEEDS_FINALIZATION";
    }).length;

    const paymentCount = includePayments ? subscriptions.filter(hasRemainingBalance).length : 0;
    const renewalCount = includeCatalog ? subscriptions.filter((subscription) => needsRenewal(subscription, now)).length : 0;
    const conflictCount =
      includeCatalog && settings
        ? buildPlanningConflictDetails({
            sessions: planningSessions.map((session) => ({
              id: session.id,
              sessionDate: session.sessionDate,
              startTime: session.startTime,
              endTime: session.endTime,
              coachId: session.coachId,
              coachName: session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : null,
              room: session.room,
              groupName: session.group.name,
              groupSportId: session.group.sportId,
              status: session.status,
            })),
            coaches: coaches.map((coach) => ({
              id: coach.id,
              qualifiedSportIds: Array.from(new Set([coach.sportId, ...coach.qualifications.map((q) => q.sportId)].filter(Boolean) as string[])),
            })),
            preferences: {
              allowSameRoomConcurrentGroups: settings.allowSameRoomConcurrentGroups,
              allowCoachConcurrentSameRoomQualified: settings.allowCoachConcurrentSameRoomQualified,
            },
          }).size
        : 0;

    return NextResponse.json({
      data: {
        badges: {
          "/attendance/today": badge(pointageCount, "amber"),
          "/payments/new": badge(paymentCount, "red"),
          "/subscriptions": badge(renewalCount, "amber"),
          "/sessions": badge(conflictCount, "red"),
        },
      },
    });
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }
}
