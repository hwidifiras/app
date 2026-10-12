import { computeFinanceSnapshot, computeMemberDebts, type FinanceSnapshot, type MemberDebtRow } from "@/lib/dashboard-finance";
import { prisma } from "@/lib/prisma";

export type DashboardDebtAgingRow = { bucket: "recent" | "warning" | "late"; amount: number; subscriptions: number };
export type DashboardExpiringSubscription = { id: string; memberId: string; firstName: string; lastName: string; planName: string; endDate: Date };
export type DashboardSubscriptionReadModel = { finance: FinanceSnapshot; debts: MemberDebtRow[]; aging: DashboardDebtAgingRow[]; expiring: DashboardExpiringSubscription[] };

export async function loadDashboardSubscriptionReadModel(input: {
  tenantId: string; now: Date; today: Date; sevenDaysFromToday: Date; debtThresholdCents: number;
}): Promise<DashboardSubscriptionReadModel> {
  const subscriptions = await prisma.memberSubscription.findMany({
    where: { tenantId: input.tenantId, status: "ACTIVE" },
    include: {
      member: true, plan: true,
      payments: { where: { tenantId: input.tenantId }, select: { amount: true } },
      renewedBySubscription: { select: { status: true, activationPolicy: true, startDate: true, activatedAt: true } },
    },
  });
  const active = subscriptions.filter((sub) => {
    if (sub.activationPolicy === "FIRST_USE" && !sub.activatedAt) return false;
    const next = sub.renewedBySubscription;
    if (!next || next.status === "CANCELLED" || next.status === "EXPIRED") return true;
    return !(next.activationPolicy === "FIXED_DATE" ? next.startDate <= input.now : next.activatedAt && next.activatedAt <= input.now);
  });
  const buckets = new Map<DashboardDebtAgingRow["bucket"], DashboardDebtAgingRow>();
  for (const sub of subscriptions) {
    const debt = Math.max(0, sub.amount - sub.payments.reduce((sum, p) => sum + p.amount, 0));
    if (!debt) continue;
    const age = (input.today.getTime() - sub.createdAt.getTime()) / 86_400_000;
    const bucket = age < 8 ? "recent" : age < 31 ? "warning" : "late";
    const row = buckets.get(bucket) ?? { bucket, amount: 0, subscriptions: 0 };
    row.amount += debt; row.subscriptions++; buckets.set(bucket, row);
  }
  return {
    finance: computeFinanceSnapshot(active, { now: input.now }),
    debts: computeMemberDebts(active, input).slice(0, 15),
    aging: (["recent", "warning", "late"] as const).flatMap((key) => buckets.has(key) ? [buckets.get(key)!] : []),
    expiring: subscriptions.filter((sub) => sub.startDate <= input.today && sub.endDate && sub.endDate >= input.today && sub.endDate <= input.sevenDaysFromToday)
      .sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime() || a.id.localeCompare(b.id)).slice(0, 3)
      .map((sub) => ({ id: sub.id, memberId: sub.memberId, firstName: sub.member.firstName, lastName: sub.member.lastName, planName: sub.plan.name, endDate: sub.endDate! })),
  };
}

export type DashboardSalesReadModel = {
  salesToday: number; salesTodayCount: number; salesMonth: number; remainingOnTodaySales: number;
  newSalesToday: number; renewalSalesToday: number; newSalesMonth: number; renewalSalesMonth: number;
  catalogueMonth: number; discountMonth: number; discountedSubscriptions: number;
  topSalesItems: Array<{ label: string; sublabel: string; amount: number; subscriptions: number }>;
};

export async function loadDashboardSalesReadModel(input: { tenantId: string; monthStart: Date; today: Date; tomorrow: Date }): Promise<DashboardSalesReadModel> {
  const sales = await prisma.memberSubscription.findMany({
    where: { tenantId: input.tenantId, status: { in: ["ACTIVE", "EXPIRED"] }, createdAt: { gte: input.monthStart, lt: input.tomorrow } },
    include: { member: true, plan: true, sport: true, payments: { where: { tenantId: input.tenantId }, select: { amount: true } } },
  });
  const todaySales = sales.filter((s) => s.createdAt >= input.today);
  const sum = (rows: typeof sales) => rows.reduce((total, s) => total + s.amount, 0);
  const newMembers = (rows: typeof sales, since: Date) => new Set(rows.filter((s) => s.member.joinedAt >= since && s.member.joinedAt < input.tomorrow).map((s) => s.memberId)).size;
  const newSalesToday = newMembers(todaySales, input.today);
  const newSalesMonth = newMembers(sales, input.monthStart);
  const items = new Map<string, DashboardSalesReadModel["topSalesItems"][number]>();
  for (const s of sales) {
    const label = s.plan.name; const sublabel = s.sport?.name ?? "Acces salle";
    const key = JSON.stringify([label, sublabel]);
    const row = items.get(key) ?? { label, sublabel, amount: 0, subscriptions: 0 };
    row.amount += s.amount; row.subscriptions++; items.set(key, row);
  }
  return {
    salesToday: sum(todaySales), salesTodayCount: todaySales.length, salesMonth: sum(sales),
    remainingOnTodaySales: Math.max(0, sum(todaySales) - todaySales.reduce((total, s) => total + s.payments.reduce((paid, p) => paid + p.amount, 0), 0)),
    newSalesToday, renewalSalesToday: Math.max(0, todaySales.length - newSalesToday),
    newSalesMonth, renewalSalesMonth: Math.max(0, sales.length - newSalesMonth),
    catalogueMonth: sales.reduce((total, s) => total + Math.max(s.listPriceCents ?? s.amount + s.discountCents, s.amount), 0),
    discountMonth: sales.reduce((total, s) => total + Math.max((s.listPriceCents ?? s.amount + s.discountCents) - s.amount, 0), 0),
    discountedSubscriptions: sales.filter((s) => (s.listPriceCents ?? s.amount + s.discountCents) > s.amount).length,
    topSalesItems: [...items.values()].sort((a, b) => b.amount - a.amount || b.subscriptions - a.subscriptions).slice(0, 3),
  };
}

export type DashboardPaymentReadModel = {
  revenueToday: number; revenueWeek: number; revenueMonth: number; paymentCountToday: number; averagePaymentToday: number;
  correctionsToday: number; reversalsToday: number; paymentCountMonth: number;
  methodStats: Array<{ method: string; amount: number; count: number }>; trend: Array<{ key: string; amount: number }>;
};

export async function loadDashboardPaymentReadModel(input: {
  tenantId: string; paymentWindowStart: Date; trendStart: Date; weekStart: Date; monthStart: Date; today: Date; tomorrow: Date;
}): Promise<DashboardPaymentReadModel> {
  const rows = await prisma.payment.findMany({ where: { tenantId: input.tenantId, paymentDate: { gte: input.paymentWindowStart, lt: input.tomorrow } } });
  const sumSince = (since: Date) => rows.filter((p) => p.paymentDate >= since).reduce((total, p) => total + p.amount, 0);
  const today = rows.filter((p) => p.paymentDate >= input.today);
  const positive = today.filter((p) => p.amount > 0);
  const methods = new Map<string, { method: string; amount: number; count: number }>();
  const trend = new Map<string, number>();
  for (const p of today) {
    const method = p.paymentMethod?.trim() || "UNKNOWN";
    const row = methods.get(method) ?? { method, amount: 0, count: 0 };
    row.amount += p.amount; row.count++; methods.set(method, row);
  }
  for (const p of rows) if (p.paymentDate >= input.trendStart) {
    const key = p.paymentDate.toISOString().slice(0, 10);
    trend.set(key, (trend.get(key) ?? 0) + p.amount);
  }
  return {
    revenueToday: sumSince(input.today), revenueWeek: sumSince(input.weekStart), revenueMonth: sumSince(input.monthStart),
    paymentCountToday: today.length, averagePaymentToday: positive.length ? Math.round(positive.reduce((total, p) => total + p.amount, 0) / positive.length) : 0,
    correctionsToday: today.filter((p) => p.entryType === "CORRECTION").length,
    reversalsToday: today.filter((p) => p.entryType === "REVERSAL").length,
    paymentCountMonth: rows.filter((p) => p.paymentDate >= input.monthStart && p.entryType === "PAYMENT" && p.amount > 0).length,
    methodStats: [...methods.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    trend: [...trend].sort(([a], [b]) => a.localeCompare(b)).map(([key, amount]) => ({ key, amount })),
  };
}
