export type SubscriptionFinanceRow = {
  id: string;
  memberId: string;
  amount: number;
  status: string;
  startDate: Date;
  endDate: Date | null;
  member: { firstName: string; lastName: string; phone: string };
  payments: { amount: number }[];
};

export type MemberDebtRow = {
  memberId: string;
  memberName: string;
  phone: string;
  totalDebt: number;
  subscriptions: number;
  partialPaid: boolean;
};

export type FinanceSnapshot = {
  totalOutstandingCents: number;
  debtorsCount: number;
  partialPayersCount: number;
  collectionRatePercent: number | null;
  expiringIn7Days: number;
  activeSubscriptionsCount: number;
};

function totalPaid(payments: { amount: number }[]) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function isActiveSubscription(sub: SubscriptionFinanceRow, now: Date) {
  if (sub.status !== "ACTIVE") return false;
  if (sub.startDate > now) return false;
  if (sub.endDate && sub.endDate < now) return false;
  return true;
}

export function computeMemberDebts(
  subscriptions: SubscriptionFinanceRow[],
  options: { debtThresholdCents: number; now?: Date },
): MemberDebtRow[] {
  const now = options.now ?? new Date();
  const debtMap = new Map<string, MemberDebtRow>();

  for (const sub of subscriptions) {
    if (!isActiveSubscription(sub, now)) continue;

    const paid = totalPaid(sub.payments);
    const outstanding = Math.max(0, sub.amount - paid);
    if (outstanding <= 0) continue;

    const entry = debtMap.get(sub.memberId) ?? {
      memberId: sub.memberId,
      memberName: `${sub.member.firstName} ${sub.member.lastName}`,
      phone: sub.member.phone,
      totalDebt: 0,
      subscriptions: 0,
      partialPaid: false,
    };

    entry.totalDebt += outstanding;
    entry.subscriptions += 1;
    entry.partialPaid = entry.partialPaid || paid > 0;
    debtMap.set(sub.memberId, entry);
  }

  return Array.from(debtMap.values())
    .filter((row) => options.debtThresholdCents <= 0 || row.totalDebt >= options.debtThresholdCents)
    .sort((a, b) => b.totalDebt - a.totalDebt);
}

export function computeFinanceSnapshot(
  subscriptions: SubscriptionFinanceRow[],
  options: { now?: Date } = {},
): FinanceSnapshot {
  const now = options.now ?? new Date();
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  let totalOutstandingCents = 0;
  let partialPayersCount = 0;
  let totalDueCents = 0;
  let totalCollectedCents = 0;
  let expiringIn7Days = 0;
  let activeSubscriptionsCount = 0;

  const debtorIds = new Set<string>();

  for (const sub of subscriptions) {
    if (!isActiveSubscription(sub, now)) continue;

    activeSubscriptionsCount += 1;
    const paid = totalPaid(sub.payments);
    const outstanding = Math.max(0, sub.amount - paid);

    totalDueCents += sub.amount;
    totalCollectedCents += Math.min(paid, sub.amount);

    if (outstanding > 0) {
      totalOutstandingCents += outstanding;
      debtorIds.add(sub.memberId);
      if (paid > 0) partialPayersCount += 1;
    }

    if (sub.endDate && sub.endDate >= now && sub.endDate <= inSevenDays) {
      expiringIn7Days += 1;
    }
  }

  const collectionRatePercent =
    totalDueCents > 0 ? Math.round((totalCollectedCents / totalDueCents) * 100) : null;

  return {
    totalOutstandingCents,
    debtorsCount: debtorIds.size,
    partialPayersCount,
    collectionRatePercent,
    expiringIn7Days,
    activeSubscriptionsCount,
  };
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfUtcWeek(date: Date) {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - diff);
  return day;
}

export function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
