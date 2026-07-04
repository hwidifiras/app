import { prisma } from "@/lib/prisma";
import { getClubSettings } from "@/lib/club-settings";
import { computeMemberDebts, type MemberDebtRow } from "@/lib/dashboard-finance";
import { isPaymentReminderEmailConfigured, sendPaymentReminderEmail } from "@/lib/email";
import {
  PAYMENT_REMINDER_COOLDOWN_DAYS,
  type DashboardDebtReminderRow,
} from "@/lib/payment-reminder-types";

export const PAYMENT_REMINDER_AUDIT_ACTION = "PAYMENT_REMINDER_SENT";
export { PAYMENT_REMINDER_COOLDOWN_DAYS, type DashboardDebtReminderRow };

export type PaymentReminderSkipReason =
  | "NO_EMAIL"
  | "NO_DEBT"
  | "COOLDOWN"
  | "MEMBER_NOT_FOUND"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";

export type PaymentReminderResult =
  | { memberId: string; status: "sent"; email: string; totalDebtCents: number }
  | { memberId: string; status: "skipped"; reason: PaymentReminderSkipReason }
  | { memberId: string; status: "failed"; reason: "EMAIL_SEND_FAILED"; email: string };

export function isReminderCooldownActive(lastReminderAt: Date | null, now = new Date()): boolean {
  if (!lastReminderAt) return false;
  const cooldownMs = PAYMENT_REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - lastReminderAt.getTime() < cooldownMs;
}

export async function getLastReminderDatesByMemberIds(
  memberIds: string[],
): Promise<Map<string, Date>> {
  if (memberIds.length === 0) return new Map();

  const logs = await prisma.auditLog.findMany({
    where: {
      action: PAYMENT_REMINDER_AUDIT_ACTION,
      entityType: "Member",
      entityId: { in: memberIds },
    },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, createdAt: true },
  });

  const map = new Map<string, Date>();
  for (const log of logs) {
    if (!map.has(log.entityId)) {
      map.set(log.entityId, log.createdAt);
    }
  }
  return map;
}

export async function enrichDebtsWithReminderMeta(
  debts: MemberDebtRow[],
  options: { now?: Date } = {},
): Promise<DashboardDebtReminderRow[]> {
  const now = options.now ?? new Date();
  const lastReminders = await getLastReminderDatesByMemberIds(debts.map((debt) => debt.memberId));

  const members = await prisma.member.findMany({
    where: { id: { in: debts.map((debt) => debt.memberId) } },
    select: { id: true, email: true },
  });
  const emailByMember = new Map(members.map((member) => [member.id, member.email?.trim() || null]));

  return debts.map((debt) => {
    const lastReminderAt = lastReminders.get(debt.memberId) ?? null;
    const email = emailByMember.get(debt.memberId) ?? null;
    const reminderBlocked = !email || isReminderCooldownActive(lastReminderAt, now);

    return {
      ...debt,
      email,
      lastReminderAt: lastReminderAt?.toISOString() ?? null,
      reminderBlocked,
    };
  });
}

async function loadMemberDebtDetails(memberId: string, now = new Date()) {
  const subscriptions = await prisma.memberSubscription.findMany({
    where: { memberId, status: "ACTIVE" },
    select: {
      id: true,
      amount: true,
      memberId: true,
      status: true,
      startDate: true,
      endDate: true,
      member: { select: { firstName: true, lastName: true, phone: true, email: true } },
      plan: { select: { name: true } },
      payments: { select: { amount: true } },
    },
  });

  const debts = computeMemberDebts(subscriptions, { debtThresholdCents: 0, now });
  const debt = debts.find((row) => row.memberId === memberId);
  if (!debt) return null;

  const lines = subscriptions
    .map((sub) => {
      const paid = sub.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = Math.max(0, sub.amount - paid);
      if (outstanding <= 0) return null;
      return {
        label: sub.plan.name,
        outstandingCents: outstanding,
      };
    })
    .filter((line): line is { label: string; outstandingCents: number } => line !== null);

  const member = subscriptions[0]?.member;
  if (!member) return null;

  return {
    memberName: `${member.firstName} ${member.lastName}`,
    email: member.email?.trim() || null,
    totalDebtCents: debt.totalDebt,
    lines,
  };
}

export async function sendPaymentReminderToMember(
  memberId: string,
  options: { actorUserId?: string | null; force?: boolean; now?: Date } = {},
): Promise<PaymentReminderResult> {
  const now = options.now ?? new Date();

  if (!isPaymentReminderEmailConfigured()) {
    return { memberId, status: "skipped", reason: "EMAIL_NOT_CONFIGURED" };
  }

  const details = await loadMemberDebtDetails(memberId, now);
  if (!details) {
    return { memberId, status: "skipped", reason: "MEMBER_NOT_FOUND" };
  }

  if (details.totalDebtCents <= 0 || details.lines.length === 0) {
    return { memberId, status: "skipped", reason: "NO_DEBT" };
  }

  if (!details.email) {
    return { memberId, status: "skipped", reason: "NO_EMAIL" };
  }

  if (!options.force) {
    const lastReminders = await getLastReminderDatesByMemberIds([memberId]);
    const lastReminderAt = lastReminders.get(memberId) ?? null;
    if (isReminderCooldownActive(lastReminderAt, now)) {
      return { memberId, status: "skipped", reason: "COOLDOWN" };
    }
  }

  const clubSettings = await getClubSettings();
  const delivery = await sendPaymentReminderEmail({
    to: details.email,
    memberName: details.memberName,
    totalDebtCents: details.totalDebtCents,
    lines: details.lines,
    clubName: clubSettings.clubName,
    clubPhone: clubSettings.clubPhone,
    clubAddress: clubSettings.clubAddress,
  });

  if (!delivery.delivered) {
    if (delivery.reason === "EMAIL_NOT_CONFIGURED") {
      return { memberId, status: "skipped", reason: "EMAIL_NOT_CONFIGURED" };
    }
    return {
      memberId,
      status: "failed",
      reason: "EMAIL_SEND_FAILED",
      email: details.email,
    };
  }

  await prisma.auditLog.create({
    data: {
      action: PAYMENT_REMINDER_AUDIT_ACTION,
      entityType: "Member",
      entityId: memberId,
      userId: options.actorUserId ?? null,
      details: JSON.stringify({
        email: details.email,
        totalDebtCents: details.totalDebtCents,
        lines: details.lines,
      }),
    },
  });

  return {
    memberId,
    status: "sent",
    email: details.email,
    totalDebtCents: details.totalDebtCents,
  };
}

export async function sendPaymentReminders(
  memberIds: string[],
  options: { actorUserId?: string | null; force?: boolean; now?: Date } = {},
): Promise<PaymentReminderResult[]> {
  const uniqueIds = [...new Set(memberIds)];
  const results: PaymentReminderResult[] = [];

  for (const memberId of uniqueIds) {
    results.push(await sendPaymentReminderToMember(memberId, options));
  }

  return results;
}
