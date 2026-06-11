import type { Offer, OfferKind, Prisma, SubscriptionPlan } from "@prisma/client";

import { getAppTimeZone } from "@/lib/dates";
import { getClubSettings } from "@/lib/club-settings";
import { resolveOfferRules } from "@/lib/offer-rules";
import type { EnrollmentLineInput } from "@/lib/schemas/enrollment";
import { prisma } from "@/lib/prisma";

export type ActiveSubscriptionView = {
  id: string;
  sportId: string;
  remainingSessions: number;
  amount: number;
  totalPaid: number;
  plan: { sportId: string; sessionsPerWeek: number | null; name: string };
};

const activeSubWhere = (memberId: string, sportId: string, now = new Date()) => ({
  memberId,
  sportId,
  status: "ACTIVE" as const,
  startDate: { lte: now },
  OR: [{ endDate: null }, { endDate: { gte: now } }],
  remainingSessions: { gt: 0 },
});

type MemberTypeValue = "ADULT" | "KID" | "NOT_SPECIFIED";
type GroupTypeValue = "KIDS" | "ADULTS";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function intervalsOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && start2 < end1;
}

export function isMemberAllowedInGroup(
  groupType: GroupTypeValue,
  memberType: MemberTypeValue,
): boolean {
  if (groupType === "KIDS") {
    return memberType === "KID" || memberType === "NOT_SPECIFIED";
  }
  return memberType === "ADULT" || memberType === "NOT_SPECIFIED";
}

async function schedulesForGroup(groupId: string) {
  return prisma.groupSchedule.findMany({
    where: { groupId },
    select: { dayOfWeek: true, startTime: true, durationMinutes: true },
  });
}

async function groupsOverlap(groupIdA: string, groupIdB: string): Promise<boolean> {
  const [aSchedules, bSchedules] = await Promise.all([
    schedulesForGroup(groupIdA),
    schedulesForGroup(groupIdB),
  ]);

  for (const a of aSchedules) {
    for (const b of bSchedules) {
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      const aStart = timeToMinutes(a.startTime);
      const bStart = timeToMinutes(b.startTime);
      if (intervalsOverlap(aStart, aStart + a.durationMinutes, bStart, bStart + b.durationMinutes)) {
        return true;
      }
    }
  }

  return false;
}

export async function checkScheduleConflictForMember(memberId: string, groupId: string) {
  const newGroupSchedules = await schedulesForGroup(groupId);
  if (newGroupSchedules.length === 0) return { ok: true as const };

  const now = new Date();
  const existingAssignments = await prisma.groupMember.findMany({
    where: {
      memberId,
      status: "ACTIVE",
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      NOT: { groupId },
    },
    select: { groupId: true, group: { select: { name: true } } },
  });

  for (const assignment of existingAssignments) {
    if (await groupsOverlap(groupId, assignment.groupId)) {
      return {
        ok: false as const,
        error: `Conflit d'horaire avec le cours "${assignment.group.name}"`,
      };
    }
  }

  return { ok: true as const };
}

async function quoteLinesOverlapForSameMember(a: ResolvedLine, b: ResolvedLine): Promise<boolean> {
  if (!a.memberId || a.memberId !== b.memberId) return false;
  if (a.group.id === b.group.id) return true;
  return groupsOverlap(a.group.id, b.group.id);
}

export function computeEndDate(startDate: Date, validityDays: number): Date {
  const end = new Date(startDate);
  end.setDate(end.getDate() + validityDays);
  return end;
}

export function getTotalPaid(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

export function isSubscriptionFullyPaid(amount: number, payments: { amount: number }[]): boolean {
  return getTotalPaid(payments) >= amount;
}

export async function expireStaleSubscriptions(memberId?: string) {
  const now = new Date();
  await prisma.memberSubscription.updateMany({
    where: {
      status: "ACTIVE",
      ...(memberId ? { memberId } : {}),
      OR: [{ endDate: { lt: now } }, { remainingSessions: { lte: 0 } }],
    },
    data: { status: "EXPIRED" },
  });
}

export async function resolveActiveSubscription(
  memberId: string,
  sportId: string,
): Promise<ActiveSubscriptionView | null> {
  await expireStaleSubscriptions(memberId);
  const now = new Date();
  const sub = await prisma.memberSubscription.findFirst({
    where: activeSubWhere(memberId, sportId, now),
    select: {
      id: true,
      sportId: true,
      remainingSessions: true,
      amount: true,
      payments: { select: { amount: true } },
      plan: { select: { sportId: true, sessionsPerWeek: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });
  if (!sub) return null;
  return {
    id: sub.id,
    sportId: sub.sportId,
    remainingSessions: sub.remainingSessions,
    amount: sub.amount,
    totalPaid: getTotalPaid(sub.payments),
    plan: sub.plan,
  };
}

export async function canCheckInWithPayment(
  sub: ActiveSubscriptionView,
): Promise<{ allowed: boolean; reason?: string }> {
  if (isSubscriptionFullyPaid(sub.amount, [{ amount: sub.totalPaid }])) {
    return { allowed: true };
  }
  const settings = await getClubSettings();
  if (settings.allowCheckInWithPartialPayment && sub.totalPaid > 0) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "Abonnement non payé — passage exceptionnel requis",
  };
}

export async function expireActiveSubscriptionForSport(
  tx: Prisma.TransactionClient,
  memberId: string,
  sportId: string,
) {
  await tx.memberSubscription.updateMany({
    where: { memberId, sportId, status: "ACTIVE" },
    data: { status: "EXPIRED" },
  });
}

export type QuoteLineResult = {
  lineIndex: number;
  memberId: string | null;
  memberName: string;
  groupId: string;
  groupName: string;
  planId: string;
  planName: string;
  sportId: string;
  sportName: string;
  listPriceCents: number;
  discountCents: number;
  finalAmountCents: number;
  endDate: string;
  totalSessions: number;
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
  reusesExistingSubscription: boolean;
};

export type QuoteResult = {
  lines: QuoteLineResult[];
  offerName: string | null;
  totalListCents: number;
  totalDiscountCents: number;
  totalFinalCents: number;
  blocked: boolean;
  warnings: string[];
};

type ResolvedLine = {
  lineIndex: number;
  input: EnrollmentLineInput;
  memberId: string;
  memberName: string;
  memberType: MemberTypeValue;
  group: { id: string; name: string; sportId: string; sport: { name: string }; capacity: number; groupType: GroupTypeValue; isActive: boolean; _count: { members: number } };
  plan: SubscriptionPlan & { sport: { name: string } };
  startDate: Date;
  endDate: Date;
  listPrice: number;
  existingSubId: string | null;
};

async function resolveEnrollmentLines(lines: EnrollmentLineInput[], startDateInput?: string) {
  const startDate = startDateInput ? new Date(startDateInput) : new Date();
  const resolved: ResolvedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const memberId = line.memberId;
    let memberName = "";
    let memberType: MemberTypeValue = line.newMember?.memberType ?? "NOT_SPECIFIED";

    if (!memberId && line.newMember) {
      memberName = `${line.newMember.firstName} ${line.newMember.lastName}`;
    } else if (memberId) {
      const m = await prisma.member.findUnique({
        where: { id: memberId },
        select: { firstName: true, lastName: true, status: true, memberType: true },
      });
      if (!m) throw new Error(`LINE_${i}:MEMBER_NOT_FOUND`);
      if (m.status === "ARCHIVED") throw new Error(`LINE_${i}:MEMBER_ARCHIVED`);
      memberName = `${m.firstName} ${m.lastName}`;
      memberType = m.memberType;
    } else {
      throw new Error(`LINE_${i}:MEMBER_REQUIRED`);
    }

    const group = await prisma.group.findUnique({
      where: { id: line.groupId },
      include: {
        sport: { select: { name: true } },
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
    });
    if (!group || !group.isActive) throw new Error(`LINE_${i}:GROUP_INVALID`);
    if (!isMemberAllowedInGroup(group.groupType, memberType)) {
      throw new Error(`LINE_${i}:MEMBER_TYPE_MISMATCH`);
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: line.planId },
      include: { sport: { select: { name: true } } },
    });
    if (!plan || !plan.isActive) throw new Error(`LINE_${i}:PLAN_INVALID`);
    if (plan.sportId !== group.sportId) throw new Error(`LINE_${i}:PLAN_SPORT_MISMATCH`);

    const endDate = computeEndDate(startDate, plan.validityDays);

    let existingSubId: string | null = null;
    if (memberId) {
      await expireStaleSubscriptions(memberId);
      const existing = await prisma.memberSubscription.findFirst({
        where: activeSubWhere(memberId, plan.sportId, startDate),
        select: { id: true },
      });
      existingSubId = existing?.id ?? null;
    }

    resolved.push({
      lineIndex: i,
      input: line,
      memberId: memberId ?? "",
      memberName,
      memberType,
      group,
      plan: plan as ResolvedLine["plan"],
      startDate,
      endDate,
      listPrice: plan.price,
      existingSubId,
    });
  }

  return resolved;
}

function validateFamilyBundleHousehold(
  resolved: ResolvedLine[],
  requiresHousehold: boolean,
  householdByMember: Map<string, string>,
): string | null {
  if (!requiresHousehold) return null;

  const existingIds = [...new Set(resolved.map((x) => x.memberId).filter(Boolean))];
  if (existingIds.length === 0) {
    return null;
  }

  const householdIds = existingIds.map((id) => householdByMember.get(id)).filter(Boolean) as string[];
  if (householdIds.length !== existingIds.length) {
    return "Offre famille : chaque élève existant doit être rattaché à un foyer (fiche élève → Famille)";
  }

  if (new Set(householdIds).size !== 1) {
    return "Offre famille : tous les élèves existants doivent être dans le même foyer";
  }

  return null;
}

function applyOfferToLines(
  resolved: ResolvedLine[],
  offer: Offer | null,
  householdByMember: Map<string, string>,
  secondSportEligible: Map<string, boolean>,
): { discounts: number[]; offerName: string | null; warnings: string[] } {
  const discounts = resolved.map(() => 0);
  const warnings: string[] = [];
  if (!offer || !offer.isActive) return { discounts, offerName: null, warnings };

  const rules = resolveOfferRules(offer);
  const listPrices = resolved.map((r) => r.listPrice);

  switch (offer.kind as OfferKind) {
    case "FAMILY_BUNDLE": {
      const r = rules as { minMembers: number; requiresHousehold: boolean; bundlePriceCents: number; sportId?: string };
      if (resolved.length < r.minMembers) {
        warnings.push(`Offre famille : au moins ${r.minMembers} inscription(s) dans ce devis`);
        return { discounts, offerName: offer.name, warnings };
      }

      const householdError = validateFamilyBundleHousehold(resolved, r.requiresHousehold, householdByMember);
      if (householdError) {
        warnings.push(householdError);
        return { discounts, offerName: offer.name, warnings };
      }

      if (r.sportId) {
        const sameSport = resolved.every((x) => x.plan.sportId === r.sportId);
        if (!sameSport) {
          warnings.push("Offre famille : même discipline requise");
          return { discounts, offerName: offer.name, warnings };
        }
      }
      const totalList = listPrices.reduce((a, b) => a + b, 0);
      const totalDiscount = Math.max(0, totalList - r.bundlePriceCents);
      const perLine = Math.floor(totalDiscount / resolved.length);
      const remainder = totalDiscount - perLine * resolved.length;
      for (let i = 0; i < resolved.length; i++) {
        discounts[i] = perLine + (i === 0 ? remainder : 0);
      }
      return { discounts, offerName: offer.name, warnings };
    }
    case "SECOND_DISCIPLINE": {
      const r = rules as { percentOff: number };
      for (let i = 0; i < resolved.length; i++) {
        const mid = resolved[i].memberId;
        if (mid && secondSportEligible.get(mid)) {
          discounts[i] = Math.round((listPrices[i] * r.percentOff) / 100);
        }
      }
      if (discounts.every((d) => d === 0)) {
        warnings.push("Offre 2e discipline : aucune ligne éligible (pas de 2e discipline pour ces élèves)");
      }
      return { discounts, offerName: offer.name, warnings };
    }
    case "PERCENT_OFF": {
      const r = rules as { percentOff: number; maxMembers?: number };
      const limit = r.maxMembers ?? resolved.length;
      for (let i = 0; i < Math.min(resolved.length, limit); i++) {
        discounts[i] = Math.round((listPrices[i] * r.percentOff) / 100);
      }
      return { discounts, offerName: offer.name, warnings };
    }
    case "FIXED_OFF": {
      const r = rules as { amountOffCents: number; maxMembers?: number };
      const limit = r.maxMembers ?? resolved.length;
      for (let i = 0; i < Math.min(resolved.length, limit); i++) {
        discounts[i] = Math.min(listPrices[i], r.amountOffCents);
      }
      return { discounts, offerName: offer.name, warnings };
    }
    default:
      return { discounts, offerName: null, warnings };
  }
}

export async function buildEnrollmentQuote(
  lines: EnrollmentLineInput[],
  offerId?: string,
  startDateInput?: string,
): Promise<QuoteResult> {
  const resolved = await resolveEnrollmentLines(lines, startDateInput);

  const memberIds = [...new Set(resolved.map((r) => r.memberId).filter(Boolean))];
  const householdLinks = await prisma.householdMember.findMany({
    where: { memberId: { in: memberIds } },
    select: { memberId: true, householdId: true },
  });
  const householdByMember = new Map(householdLinks.map((h) => [h.memberId, h.householdId]));

  const secondSportEligible = new Map<string, boolean>();
  for (const mid of memberIds) {
    const sportsInQuote = new Set(
      resolved.filter((r) => r.memberId === mid).map((r) => r.plan.sportId),
    );
    const existingSports = await prisma.memberSubscription.findMany({
      where: { memberId: mid, status: "ACTIVE" },
      select: { sportId: true },
    });
    const hasOther =
      existingSports.some((s) => !sportsInQuote.has(s.sportId)) || sportsInQuote.size > 1;
    secondSportEligible.set(mid, hasOther);
  }

  let offer: Offer | null = null;
  if (offerId) {
    offer = await prisma.offer.findUnique({ where: { id: offerId } });
  }

  const { discounts, offerName, warnings: offerWarnings } = applyOfferToLines(
    resolved,
    offer,
    householdByMember,
    secondSportEligible,
  );

  const quoteLines: QuoteLineResult[] = [];
  const allWarnings: string[] = [...offerWarnings];
  const offerBlocksQuote = offerWarnings.some((w) =>
    w.startsWith("Offre famille") || w.startsWith("Offre 2e discipline : aucune"),
  );
  let blocked = offerBlocksQuote;
  const groupSeatNeeds = new Map<string, number>();
  for (const r of resolved) {
    const existingAssignment = r.memberId
      ? await prisma.groupMember.findUnique({
          where: { groupId_memberId: { groupId: r.group.id, memberId: r.memberId } },
          select: { status: true },
        })
      : null;
    const addsSeat = !existingAssignment || existingAssignment.status !== "ACTIVE";
    if (addsSeat) {
      groupSeatNeeds.set(r.group.id, (groupSeatNeeds.get(r.group.id) ?? 0) + 1);
    }
  }

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
    const lineWarnings: string[] = [];
    let lineBlocked = false;
    let blockReason: string | undefined;

    const seatsNeededInQuote = groupSeatNeeds.get(r.group.id) ?? 0;

    if (r.group._count.members + seatsNeededInQuote > r.group.capacity) {
      lineWarnings.push("Capacité du cours atteinte");
      lineBlocked = true;
      blockReason = "Capacité du cours atteinte";
    }

    if (r.memberId) {
      const scheduleConflict = await checkScheduleConflictForMember(r.memberId, r.group.id);
      if (!scheduleConflict.ok) {
        lineWarnings.push(scheduleConflict.error);
        lineBlocked = true;
        blockReason = scheduleConflict.error;
      }
    }

    for (const previous of resolved.slice(0, i)) {
      if (await quoteLinesOverlapForSameMember(r, previous)) {
        const msg = `Conflit d'horaire dans ce devis avec "${previous.group.name}"`;
        lineWarnings.push(msg);
        lineBlocked = true;
        blockReason = msg;
      }
    }

    const discount = discounts[i] ?? 0;
    const finalAmount = Math.max(0, r.listPrice - discount);
    const reuses = !!r.existingSubId && discount === 0;

    quoteLines.push({
      lineIndex: i,
      memberId: r.memberId || null,
      memberName: r.memberName,
      groupId: r.group.id,
      groupName: r.group.name,
      planId: r.plan.id,
      planName: r.plan.name,
      sportId: r.plan.sportId,
      sportName: r.plan.sport.name,
      listPriceCents: r.listPrice,
      discountCents: discount,
      finalAmountCents: finalAmount,
      endDate: r.endDate.toISOString(),
      totalSessions: r.plan.totalSessions,
      warnings: lineWarnings,
      blocked: lineBlocked,
      blockReason,
      reusesExistingSubscription: reuses,
    });

    if (lineBlocked) blocked = true;
    allWarnings.push(...lineWarnings);
  }

  return {
    lines: quoteLines,
    offerName,
    totalListCents: quoteLines.reduce((s, l) => s + l.listPriceCents, 0),
    totalDiscountCents: quoteLines.reduce((s, l) => s + l.discountCents, 0),
    totalFinalCents: quoteLines.reduce((s, l) => s + l.finalAmountCents, 0),
    blocked,
    warnings: allWarnings,
  };
}

/** After a family enrollment, link all members into one household when needed. */
export async function ensureSharedHouseholdForMembers(
  tx: Pick<typeof prisma, "household" | "householdMember">,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length < 2) return;

  const links = await tx.householdMember.findMany({
    where: { memberId: { in: memberIds } },
    select: { memberId: true, householdId: true },
  });
  const byMember = new Map(links.map((l) => [l.memberId, l.householdId]));

  let targetHouseholdId: string | null = null;
  for (const id of memberIds) {
    const hid = byMember.get(id);
    if (!hid) continue;
    if (targetHouseholdId && targetHouseholdId !== hid) {
      throw new Error("HOUSEHOLD_CONFLICT");
    }
    targetHouseholdId = hid;
  }

  if (!targetHouseholdId) {
    const created = await tx.household.create({ data: { label: null } });
    targetHouseholdId = created.id;
  }

  for (const id of memberIds) {
    if (byMember.has(id)) continue;
    const taken = await tx.householdMember.findUnique({ where: { memberId: id } });
    if (taken) throw new Error("HOUSEHOLD_MEMBER_TAKEN");
    await tx.householdMember.create({
      data: { householdId: targetHouseholdId, memberId: id, relationship: "OTHER" },
    });
  }
}

export async function validateStaffOfferDiscount(
  role: "ADMIN" | "STAFF",
  percentOff: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getClubSettings();
  const max = role === "ADMIN" ? 100 : settings.maxStaffDiscountPercent;
  if (percentOff > max) {
    return { ok: false, error: `Réduction max ${max}% pour votre rôle` };
  }
  return { ok: true };
}

export { getAppTimeZone };
