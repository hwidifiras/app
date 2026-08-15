import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const MEMBER_DIRECTORY_PAGE_SIZE = 10;
export const MEMBER_DIRECTORY_MAX_PAGE_SIZE = 50;

export type MemberDirectoryStatus = "ALL" | "ACTIVE" | "ARCHIVED";
export type MemberDirectoryPaymentStatus = "ALL" | "PAID" | "PARTIAL" | "UNPAID";

export type MemberDirectoryRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: "ACTIVE" | "ARCHIVED";
  paymentStatus: Exclude<MemberDirectoryPaymentStatus, "ALL">;
  createdAt: string;
  groupIds: string[];
};

export type MemberDirectoryPage = {
  data: MemberDirectoryRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

type DirectoryInput = {
  tenantId: string;
  page?: number;
  pageSize?: number;
  query?: string;
  status?: MemberDirectoryStatus;
  paymentStatus?: MemberDirectoryPaymentStatus;
  sportId?: string;
};

type PaymentFilteredId = {
  id: string;
  total: number;
};

function directoryWhere(input: DirectoryInput): Prisma.MemberWhereInput {
  const query = input.query?.trim();
  const queryTerms = query?.split(/\s+/).filter(Boolean) ?? [];
  const sportId = input.sportId?.trim();

  return {
    tenantId: input.tenantId,
    ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
    ...(queryTerms.length > 0
      ? {
          AND: queryTerms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { phone: { contains: term, mode: "insensitive" as const } },
              { email: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : {}),
    ...(sportId && sportId !== "ALL"
      ? {
          groups: {
            some: {
              tenantId: input.tenantId,
              status: "ACTIVE",
              group: {
                tenantId: input.tenantId,
                sportId,
                isActive: true,
              },
            },
          },
        }
      : {}),
  };
}

function rawDirectoryConditions(input: DirectoryInput) {
  const conditions: Prisma.Sql[] = [Prisma.sql`m."tenantId" = ${input.tenantId}`];
  const query = input.query?.trim();
  const sportId = input.sportId?.trim();

  if (input.status && input.status !== "ALL") {
    conditions.push(Prisma.sql`m.status = ${input.status}::"MemberStatus"`);
  }

  if (query) {
    const pattern = `%${query}%`;
    conditions.push(Prisma.sql`(
      m."firstName" ILIKE ${pattern}
      OR m."lastName" ILIKE ${pattern}
      OR CONCAT(m."firstName", ' ', m."lastName") ILIKE ${pattern}
      OR m.phone ILIKE ${pattern}
      OR COALESCE(m.email, '') ILIKE ${pattern}
    )`);
  }

  if (sportId && sportId !== "ALL") {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "GroupMember" gm
      INNER JOIN "Group" g ON g.id = gm."groupId"
      WHERE gm."tenantId" = ${input.tenantId}
        AND g."tenantId" = ${input.tenantId}
        AND gm."memberId" = m.id
        AND gm.status = 'ACTIVE'::"GroupMemberStatus"
        AND g."isActive" = TRUE
        AND g."sportId" = ${sportId}
    )`);
  }

  if (input.paymentStatus === "PAID") {
    conditions.push(Prisma.sql`latest.id IS NOT NULL AND latest.paid >= latest.amount`);
  } else if (input.paymentStatus === "PARTIAL") {
    conditions.push(Prisma.sql`latest.id IS NOT NULL AND latest.paid > 0 AND latest.paid < latest.amount`);
  } else if (input.paymentStatus === "UNPAID") {
    conditions.push(Prisma.sql`(latest.id IS NULL OR latest.paid <= 0)`);
  }

  return conditions;
}

async function paymentFilteredPageIds(input: DirectoryInput, pageSize: number, offset: number) {
  const conditions = rawDirectoryConditions(input);

  return prisma.$queryRaw<PaymentFilteredId[]>(Prisma.sql`
    WITH latest_subscription_id AS MATERIALIZED (
      SELECT DISTINCT ON (ms."memberId")
        ms.id,
        ms."memberId",
        ms.amount
      FROM "MemberSubscription" ms
      WHERE ms."tenantId" = ${input.tenantId}
        AND ms.status = 'ACTIVE'::"SubscriptionStatus"
      ORDER BY ms."memberId", ms."createdAt" DESC, ms.id DESC
    ),
    latest_subscription AS (
      SELECT
        latest.id,
        latest."memberId",
        latest.amount,
        COALESCE(SUM(p.amount), 0) AS paid
      FROM latest_subscription_id latest
      LEFT JOIN "Payment" p
        ON p."memberSubscriptionId" = latest.id
       AND p."tenantId" = ${input.tenantId}
      GROUP BY latest.id, latest."memberId", latest.amount
    )
    SELECT m.id, COUNT(*) OVER()::INTEGER AS total
    FROM "Member" m
    LEFT JOIN latest_subscription latest ON latest."memberId" = m.id
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY m."createdAt" DESC, m.id DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);
}

const directorySelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  status: true,
  createdAt: true,
  groups: {
    where: { status: "ACTIVE" as const },
    select: { groupId: true },
  },
  subscriptions: {
    where: { status: "ACTIVE" as const },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
    select: {
      id: true,
      amount: true,
    },
  },
} satisfies Prisma.MemberSelect;

function toDirectoryRow(
  member: Prisma.MemberGetPayload<{ select: typeof directorySelect }>,
  paidBySubscriptionId: Map<string, number>,
): MemberDirectoryRow {
  const latestSubscription = member.subscriptions[0];
  const paid = latestSubscription ? (paidBySubscriptionId.get(latestSubscription.id) ?? 0) : 0;
  const paymentStatus: MemberDirectoryRow["paymentStatus"] = latestSubscription
    ? paid >= latestSubscription.amount
      ? "PAID"
      : paid > 0
        ? "PARTIAL"
        : "UNPAID"
    : "UNPAID";

  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    email: member.email,
    status: member.status,
    paymentStatus,
    createdAt: member.createdAt.toISOString(),
    groupIds: member.groups.map((group) => group.groupId),
  };
}

export async function getMemberDirectoryPage(input: DirectoryInput): Promise<MemberDirectoryPage> {
  const requestedPage = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(
    MEMBER_DIRECTORY_MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(input.pageSize ?? MEMBER_DIRECTORY_PAGE_SIZE)),
  );
  const where = directoryWhere(input);
  let total = 0;
  let page = requestedPage;
  let members: Prisma.MemberGetPayload<{ select: typeof directorySelect }>[] = [];

  if (input.paymentStatus && input.paymentStatus !== "ALL") {
    let rows = await paymentFilteredPageIds(input, pageSize, (page - 1) * pageSize);
    if (rows.length === 0 && page > 1) {
      rows = await paymentFilteredPageIds(input, pageSize, 0);
      page = 1;
    }
    total = rows[0]?.total ?? 0;
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      const unordered = await prisma.member.findMany({
        where: { tenantId: input.tenantId, id: { in: ids } },
        select: directorySelect,
      });
      const byId = new Map(unordered.map((member) => [member.id, member]));
      members = ids.flatMap((id) => {
        const member = byId.get(id);
        return member ? [member] : [];
      });
    }
  } else {
    total = await prisma.member.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pageCount);
    members = await prisma.member.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: directorySelect,
    });
  }

  const subscriptionIds = members.flatMap((member) => member.subscriptions.map((subscription) => subscription.id));
  const paymentTotals = subscriptionIds.length > 0
    ? await prisma.payment.groupBy({
        by: ["memberSubscriptionId"],
        where: {
          tenantId: input.tenantId,
          memberSubscriptionId: { in: subscriptionIds },
        },
        _sum: { amount: true },
      })
    : [];
  const paidBySubscriptionId = new Map(
    paymentTotals.map((item) => [item.memberSubscriptionId, item._sum.amount ?? 0]),
  );

  return {
    data: members.map((member) => toDirectoryRow(member, paidBySubscriptionId)),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}
