import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  isPaymentReminderEmailConfigured: vi.fn(() => true),
  sendPaymentReminderEmail: vi.fn(async () => ({ delivered: true as const })),
}));

import { prisma } from "@/lib/prisma";
import {
  isReminderCooldownActive,
  PAYMENT_REMINDER_AUDIT_ACTION,
  sendPaymentReminderToMember,
} from "@/lib/payment-reminders";
import { sendPaymentReminderEmail } from "@/lib/email";

describe("payment reminders", () => {
  beforeEach(() => {
    vi.mocked(sendPaymentReminderEmail).mockResolvedValue({ delivered: true });
  });

  it("detects active cooldown windows", () => {
    const now = new Date("2026-06-11T12:00:00.000Z");
    const recent = new Date("2026-06-10T12:00:00.000Z");
    expect(isReminderCooldownActive(recent, now)).toBe(true);
    expect(isReminderCooldownActive(new Date("2026-06-01T12:00:00.000Z"), now)).toBe(false);
  });

  it("skips members without email", async () => {
    const sport = await prisma.sport.create({ data: { name: `Sport-${Date.now()}` } });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `Plan-${Date.now()}`,
        price: 5000,
        totalSessions: 8,
        validityDays: 30,
        sportId: sport.id,
      },
    });
    const member = await prisma.member.create({
      data: {
        firstName: "Sam",
        lastName: "Test",
        phone: `phone-${Date.now()}`,
      },
    });
    await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        sportId: sport.id,
        amount: 5000,
        remainingSessions: 8,
        status: "ACTIVE",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
      },
    });

    const result = await sendPaymentReminderToMember(member.id, {
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("NO_EMAIL");
    }
  });

  it("sends reminder email and writes audit log", async () => {
    const sport = await prisma.sport.create({ data: { name: `Sport-${Date.now()}` } });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `Plan-${Date.now()}`,
        price: 5000,
        totalSessions: 8,
        validityDays: 30,
        sportId: sport.id,
      },
    });
    const member = await prisma.member.create({
      data: {
        firstName: "Alex",
        lastName: "Payeur",
        phone: `phone-${Date.now()}`,
        email: "alex@example.com",
      },
    });
    await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        sportId: sport.id,
        amount: 5000,
        remainingSessions: 8,
        status: "ACTIVE",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
      },
    });

    const result = await sendPaymentReminderToMember(member.id, {
      actorUserId: "staff-1",
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(result.status).toBe("sent");
    expect(sendPaymentReminderEmail).toHaveBeenCalledTimes(1);

    const log = await prisma.auditLog.findFirst({
      where: { action: PAYMENT_REMINDER_AUDIT_ACTION, entityId: member.id },
    });
    expect(log).toBeTruthy();
  });

  it("blocks duplicate reminders during cooldown", async () => {
    const sport = await prisma.sport.create({ data: { name: `Sport-${Date.now()}` } });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `Plan-${Date.now()}`,
        price: 5000,
        totalSessions: 8,
        validityDays: 30,
        sportId: sport.id,
      },
    });
    const member = await prisma.member.create({
      data: {
        firstName: "Lee",
        lastName: "Cooldown",
        phone: `phone-${Date.now()}`,
        email: "lee@example.com",
      },
    });
    await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        sportId: sport.id,
        amount: 5000,
        remainingSessions: 8,
        status: "ACTIVE",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
      },
    });

    const now = new Date("2026-06-11T12:00:00.000Z");
    const first = await sendPaymentReminderToMember(member.id, { now });
    const second = await sendPaymentReminderToMember(member.id, { now });

    expect(first.status).toBe("sent");
    expect(second.status).toBe("skipped");
    if (second.status === "skipped") {
      expect(second.reason).toBe("COOLDOWN");
    }
  });
});
