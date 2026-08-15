import { Prisma } from "@prisma/client";

import type { FinanceSnapshot, MemberDebtRow } from "@/lib/dashboard-finance";
import { prisma } from "@/lib/prisma";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export type DashboardDebtAgingRow = {
  bucket: "recent" | "warning" | "late";
  amount: number;
  subscriptions: number;
};

export type DashboardExpiringSubscription = {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  planName: string;
  endDate: Date;
};

export type DashboardSubscriptionReadModel = {
  finance: FinanceSnapshot;
  debts: MemberDebtRow[];
  aging: DashboardDebtAgingRow[];
  expiring: DashboardExpiringSubscription[];
};

export async function loadDashboardSubscriptionReadModel(input: {
  tenantId: string;
  now: Date;
  today: Date;
  sevenDaysFromToday: Date;
  debtThresholdCents: number;
}): Promise<DashboardSubscriptionReadModel> {
  const [row] = await prisma.$queryRaw<
    Array<{ finance: unknown; debts: unknown; aging: unknown; expiring: unknown }>
  >(Prisma.sql`
    WITH subscription_balances AS MATERIALIZED (
      SELECT
        ms.id,
        ms."memberId",
        ms.amount,
        ms."createdAt",
        ms."startDate",
        ms."endDate",
        ms."activationPolicy",
        ms."activatedAt",
        m."firstName",
        m."lastName",
        m.phone,
        sp.name AS "planName",
        COALESCE(SUM(p.amount), 0) AS paid
      FROM "MemberSubscription" ms
      INNER JOIN "Member" m
        ON m.id = ms."memberId"
       AND m."tenantId" = ${input.tenantId}
      INNER JOIN "SubscriptionPlan" sp
        ON sp.id = ms."planId"
       AND sp."tenantId" = ${input.tenantId}
      LEFT JOIN "Payment" p
        ON p."memberSubscriptionId" = ms.id
       AND p."tenantId" = ${input.tenantId}
      WHERE ms."tenantId" = ${input.tenantId}
        AND ms.status = 'ACTIVE'::"SubscriptionStatus"
      GROUP BY
        ms.id,
        ms."memberId",
        ms.amount,
        ms."createdAt",
        ms."startDate",
        ms."endDate",
        ms."activationPolicy",
        ms."activatedAt",
        m."firstName",
        m."lastName",
        m.phone,
        sp.name
    ),
    active_balances AS MATERIALIZED (
      SELECT *
      FROM subscription_balances
      WHERE "startDate" <= ${input.now}
        AND ("endDate" IS NULL OR "endDate" >= ${input.now})
        AND ("activationPolicy" <> 'FIRST_USE'::"PlanActivationPolicy" OR "activatedAt" IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1
          FROM "MemberSubscription" successor
          WHERE successor."tenantId" = ${input.tenantId}
            AND successor."renewsSubscriptionId" = subscription_balances.id
            AND successor.status NOT IN ('CANCELLED'::"SubscriptionStatus", 'EXPIRED'::"SubscriptionStatus")
            AND (
              (successor."activationPolicy" = 'FIXED_DATE'::"PlanActivationPolicy" AND successor."startDate" <= ${input.now})
              OR
              (successor."activationPolicy" = 'FIRST_USE'::"PlanActivationPolicy" AND successor."activatedAt" IS NOT NULL AND successor."activatedAt" <= ${input.now})
            )
        )
    ),
    debt_rows AS (
      SELECT
        "memberId",
        MAX("firstName") AS "firstName",
        MAX("lastName") AS "lastName",
        MAX(phone) AS phone,
        SUM(GREATEST(amount - paid, 0)) AS "totalDebt",
        COUNT(*) FILTER (WHERE amount - paid > 0)::INTEGER AS subscriptions,
        BOOL_OR(paid > 0 AND amount - paid > 0) AS "partialPaid"
      FROM active_balances
      GROUP BY "memberId"
      HAVING SUM(GREATEST(amount - paid, 0)) > 0
        AND (
          ${input.debtThresholdCents} <= 0
          OR SUM(GREATEST(amount - paid, 0)) >= ${input.debtThresholdCents}
        )
      ORDER BY "totalDebt" DESC
      LIMIT 15
    ),
    aging_rows AS (
      SELECT
        CASE
          WHEN "createdAt" > ${input.today} - INTERVAL '8 days' THEN 'recent'
          WHEN "createdAt" > ${input.today} - INTERVAL '31 days' THEN 'warning'
          ELSE 'late'
        END AS bucket,
        SUM(GREATEST(amount - paid, 0)) AS amount,
        COUNT(*)::INTEGER AS subscriptions
      FROM subscription_balances
      WHERE amount - paid > 0
      GROUP BY bucket
    ),
    expiring_rows AS (
      SELECT id, "memberId", "firstName", "lastName", "planName", "endDate"
      FROM subscription_balances
      WHERE "startDate" <= ${input.today}
        AND "endDate" >= ${input.today}
        AND "endDate" <= ${input.sevenDaysFromToday}
      ORDER BY "endDate" ASC, id ASC
      LIMIT 3
    )
    SELECT
      (
        SELECT jsonb_build_object(
          'totalOutstandingCents', COALESCE(SUM(GREATEST(amount - paid, 0)), 0),
          'debtorsCount', COUNT(DISTINCT "memberId") FILTER (WHERE amount - paid > 0),
          'partialPayersCount', COUNT(*) FILTER (WHERE paid > 0 AND amount - paid > 0),
          'collectionRatePercent', CASE
            WHEN COALESCE(SUM(amount), 0) > 0
            THEN ROUND((SUM(LEAST(paid, amount))::NUMERIC / SUM(amount)::NUMERIC) * 100)::INTEGER
            ELSE NULL
          END,
          'expiringIn7Days', COUNT(*) FILTER (
            WHERE "endDate" >= ${input.now}
              AND "endDate" <= ${input.now} + INTERVAL '7 days'
          ),
          'activeSubscriptionsCount', COUNT(*)
        )
        FROM active_balances
      ) AS finance,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'memberId', "memberId",
              'memberName', CONCAT("firstName", ' ', "lastName"),
              'phone', phone,
              'totalDebt', "totalDebt",
              'subscriptions', subscriptions,
              'partialPaid', "partialPaid"
            )
            ORDER BY "totalDebt" DESC
          ),
          '[]'::JSONB
        )
        FROM debt_rows
      ) AS debts,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'bucket', bucket,
              'amount', amount,
              'subscriptions', subscriptions
            )
            ORDER BY CASE bucket WHEN 'recent' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END
          ),
          '[]'::JSONB
        )
        FROM aging_rows
      ) AS aging,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'memberId', "memberId",
              'firstName', "firstName",
              'lastName', "lastName",
              'planName', "planName",
              'endDate', TO_CHAR("endDate", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
            ORDER BY "endDate", id
          ),
          '[]'::JSONB
        )
        FROM expiring_rows
      ) AS expiring
  `);

  const finance = record(row?.finance);
  return {
    finance: {
      totalOutstandingCents: numberValue(finance.totalOutstandingCents),
      debtorsCount: numberValue(finance.debtorsCount),
      partialPayersCount: numberValue(finance.partialPayersCount),
      collectionRatePercent:
        finance.collectionRatePercent === null || finance.collectionRatePercent === undefined
          ? null
          : numberValue(finance.collectionRatePercent),
      expiringIn7Days: numberValue(finance.expiringIn7Days),
      activeSubscriptionsCount: numberValue(finance.activeSubscriptionsCount),
    },
    debts: records(row?.debts).map((item) => ({
      memberId: stringValue(item.memberId),
      memberName: stringValue(item.memberName),
      phone: stringValue(item.phone),
      totalDebt: numberValue(item.totalDebt),
      subscriptions: numberValue(item.subscriptions),
      partialPaid: item.partialPaid === true,
    })),
    aging: records(row?.aging).flatMap((item) => {
      const bucket = item.bucket;
      if (bucket !== "recent" && bucket !== "warning" && bucket !== "late") return [];
      return [{
        bucket,
        amount: numberValue(item.amount),
        subscriptions: numberValue(item.subscriptions),
      }];
    }),
    expiring: records(row?.expiring).flatMap((item) => {
      const endDate = new Date(stringValue(item.endDate));
      if (Number.isNaN(endDate.getTime())) return [];
      return [{
        id: stringValue(item.id),
        memberId: stringValue(item.memberId),
        firstName: stringValue(item.firstName),
        lastName: stringValue(item.lastName),
        planName: stringValue(item.planName),
        endDate,
      }];
    }),
  };
}

export type DashboardSalesReadModel = {
  salesToday: number;
  salesTodayCount: number;
  salesMonth: number;
  remainingOnTodaySales: number;
  newSalesToday: number;
  renewalSalesToday: number;
  newSalesMonth: number;
  renewalSalesMonth: number;
  catalogueMonth: number;
  discountMonth: number;
  discountedSubscriptions: number;
  topSalesItems: Array<{ label: string; sublabel: string; amount: number; subscriptions: number }>;
};

export async function loadDashboardSalesReadModel(input: {
  tenantId: string;
  monthStart: Date;
  today: Date;
  tomorrow: Date;
}): Promise<DashboardSalesReadModel> {
  const [row] = await prisma.$queryRaw<Array<{ summary: unknown; topItems: unknown }>>(Prisma.sql`
    WITH monthly_sales AS MATERIALIZED (
      SELECT
        ms.id,
        ms."memberId",
        ms.amount,
        ms."listPriceCents",
        ms."discountCents",
        ms."createdAt",
        m."joinedAt",
        sp.name AS "planName",
        COALESCE(s.name, 'Acces salle') AS "sportName",
        COALESCE(SUM(p.amount), 0) AS paid
      FROM "MemberSubscription" ms
      INNER JOIN "Member" m
        ON m.id = ms."memberId"
       AND m."tenantId" = ${input.tenantId}
      INNER JOIN "SubscriptionPlan" sp
        ON sp.id = ms."planId"
       AND sp."tenantId" = ${input.tenantId}
      LEFT JOIN "Sport" s
        ON s.id = ms."sportId"
       AND s."tenantId" = ${input.tenantId}
      LEFT JOIN "Payment" p
        ON p."memberSubscriptionId" = ms.id
       AND p."tenantId" = ${input.tenantId}
      WHERE ms."tenantId" = ${input.tenantId}
        AND ms.status IN ('ACTIVE'::"SubscriptionStatus", 'EXPIRED'::"SubscriptionStatus")
        AND ms."createdAt" >= ${input.monthStart}
        AND ms."createdAt" < ${input.tomorrow}
      GROUP BY
        ms.id,
        ms."memberId",
        ms.amount,
        ms."listPriceCents",
        ms."discountCents",
        ms."createdAt",
        m."joinedAt",
        sp.name,
        s.name
    ),
    top_items AS (
      SELECT
        "planName" AS label,
        "sportName" AS sublabel,
        SUM(amount) AS amount,
        COUNT(*)::INTEGER AS subscriptions
      FROM monthly_sales
      GROUP BY "planName", "sportName"
      ORDER BY amount DESC, subscriptions DESC
      LIMIT 3
    )
    SELECT
      (
        SELECT jsonb_build_object(
          'salesToday', COALESCE(SUM(amount) FILTER (WHERE "createdAt" >= ${input.today}), 0),
          'salesTodayCount', COUNT(*) FILTER (WHERE "createdAt" >= ${input.today}),
          'salesMonth', COALESCE(SUM(amount), 0),
          'salesMonthCount', COUNT(*),
          'paidOnTodaySales', COALESCE(SUM(paid) FILTER (WHERE "createdAt" >= ${input.today}), 0),
          'newSalesToday', COUNT(DISTINCT "memberId") FILTER (
            WHERE "createdAt" >= ${input.today}
              AND "joinedAt" >= ${input.today}
              AND "joinedAt" < ${input.tomorrow}
          ),
          'newSalesMonth', COUNT(DISTINCT "memberId") FILTER (
            WHERE "joinedAt" >= ${input.monthStart}
              AND "joinedAt" < ${input.tomorrow}
          ),
          'catalogueMonth', COALESCE(SUM(GREATEST(COALESCE("listPriceCents", amount + "discountCents"), amount)), 0),
          'discountMonth', COALESCE(SUM(GREATEST(COALESCE("listPriceCents", amount + "discountCents") - amount, 0)), 0),
          'discountedSubscriptions', COUNT(*) FILTER (
            WHERE GREATEST(COALESCE("listPriceCents", amount + "discountCents") - amount, 0) > 0
          )
        )
        FROM monthly_sales
      ) AS summary,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'label', label,
              'sublabel', sublabel,
              'amount', amount,
              'subscriptions', subscriptions
            )
            ORDER BY amount DESC, subscriptions DESC
          ),
          '[]'::JSONB
        )
        FROM top_items
      ) AS "topItems"
  `);

  const summary = record(row?.summary);
  const salesToday = numberValue(summary.salesToday);
  const salesTodayCount = numberValue(summary.salesTodayCount);
  const salesMonth = numberValue(summary.salesMonth);
  const salesMonthCount = numberValue(summary.salesMonthCount);
  const paidOnTodaySales = numberValue(summary.paidOnTodaySales);
  const newSalesToday = numberValue(summary.newSalesToday);
  const newSalesMonth = numberValue(summary.newSalesMonth);

  return {
    salesToday,
    salesTodayCount,
    salesMonth,
    remainingOnTodaySales: Math.max(0, salesToday - paidOnTodaySales),
    newSalesToday,
    renewalSalesToday: Math.max(0, salesTodayCount - newSalesToday),
    newSalesMonth,
    renewalSalesMonth: Math.max(0, salesMonthCount - newSalesMonth),
    catalogueMonth: numberValue(summary.catalogueMonth),
    discountMonth: numberValue(summary.discountMonth),
    discountedSubscriptions: numberValue(summary.discountedSubscriptions),
    topSalesItems: records(row?.topItems).map((item) => ({
      label: stringValue(item.label),
      sublabel: stringValue(item.sublabel),
      amount: numberValue(item.amount),
      subscriptions: numberValue(item.subscriptions),
    })),
  };
}

export type DashboardPaymentReadModel = {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  paymentCountToday: number;
  averagePaymentToday: number;
  correctionsToday: number;
  reversalsToday: number;
  paymentCountMonth: number;
  methodStats: Array<{ method: string; amount: number; count: number }>;
  trend: Array<{ key: string; amount: number }>;
};

export async function loadDashboardPaymentReadModel(input: {
  tenantId: string;
  paymentWindowStart: Date;
  trendStart: Date;
  weekStart: Date;
  monthStart: Date;
  today: Date;
  tomorrow: Date;
}): Promise<DashboardPaymentReadModel> {
  const [row] = await prisma.$queryRaw<Array<{ summary: unknown; methods: unknown; trend: unknown }>>(Prisma.sql`
    WITH payment_window AS MATERIALIZED (
      SELECT amount, "entryType", "paymentMethod", "paymentDate"
      FROM "Payment"
      WHERE "tenantId" = ${input.tenantId}
        AND "paymentDate" >= ${input.paymentWindowStart}
        AND "paymentDate" < ${input.tomorrow}
    ),
    method_rows AS (
      SELECT
        COALESCE(NULLIF(TRIM("paymentMethod"), ''), 'UNKNOWN') AS method,
        SUM(amount) AS amount,
        COUNT(*)::INTEGER AS count
      FROM payment_window
      WHERE "paymentDate" >= ${input.today}
      GROUP BY method
    ),
    trend_rows AS (
      SELECT TO_CHAR("paymentDate", 'YYYY-MM-DD') AS key, SUM(amount) AS amount
      FROM payment_window
      WHERE "paymentDate" >= ${input.trendStart}
      GROUP BY key
    )
    SELECT
      (
        SELECT jsonb_build_object(
          'revenueToday', COALESCE(SUM(amount) FILTER (WHERE "paymentDate" >= ${input.today}), 0),
          'revenueWeek', COALESCE(SUM(amount) FILTER (WHERE "paymentDate" >= ${input.weekStart}), 0),
          'revenueMonth', COALESCE(SUM(amount) FILTER (WHERE "paymentDate" >= ${input.monthStart}), 0),
          'paymentCountToday', COUNT(*) FILTER (WHERE "paymentDate" >= ${input.today}),
          'averagePaymentToday', COALESCE(ROUND(AVG(amount) FILTER (
            WHERE "paymentDate" >= ${input.today} AND amount > 0
          )), 0),
          'correctionsToday', COUNT(*) FILTER (
            WHERE "paymentDate" >= ${input.today} AND "entryType" = 'CORRECTION'::"PaymentEntryType"
          ),
          'reversalsToday', COUNT(*) FILTER (
            WHERE "paymentDate" >= ${input.today} AND "entryType" = 'REVERSAL'::"PaymentEntryType"
          ),
          'paymentCountMonth', COUNT(*) FILTER (
            WHERE "paymentDate" >= ${input.monthStart}
              AND "entryType" = 'PAYMENT'::"PaymentEntryType"
              AND amount > 0
          )
        )
        FROM payment_window
      ) AS summary,
      (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('method', method, 'amount', amount, 'count', count) ORDER BY ABS(amount) DESC),
          '[]'::JSONB
        )
        FROM method_rows
      ) AS methods,
      (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('key', key, 'amount', amount) ORDER BY key),
          '[]'::JSONB
        )
        FROM trend_rows
      ) AS trend
  `);

  const summary = record(row?.summary);
  return {
    revenueToday: numberValue(summary.revenueToday),
    revenueWeek: numberValue(summary.revenueWeek),
    revenueMonth: numberValue(summary.revenueMonth),
    paymentCountToday: numberValue(summary.paymentCountToday),
    averagePaymentToday: numberValue(summary.averagePaymentToday),
    correctionsToday: numberValue(summary.correctionsToday),
    reversalsToday: numberValue(summary.reversalsToday),
    paymentCountMonth: numberValue(summary.paymentCountMonth),
    methodStats: records(row?.methods).map((item) => ({
      method: stringValue(item.method) || "UNKNOWN",
      amount: numberValue(item.amount),
      count: numberValue(item.count),
    })),
    trend: records(row?.trend).map((item) => ({
      key: stringValue(item.key),
      amount: numberValue(item.amount),
    })),
  };
}
