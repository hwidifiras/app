import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const legacyGrants = {
  "enrollment.manage": ["enrollment.sell"],
  "attendance.manage": ["class.attendance"],
  "payments.manage": ["payments.collect", "payments.correct", "reports.finance"],
  "catalog.manage": ["class.manage", "plans.manage", "subscriptions.correct"],
  "offers.manage": ["plans.manage"],
  "gym.manage": ["gym.correct"],
};

const staffUsers = await prisma.user.findMany({
  where: { role: "STAFF" },
  select: {
    id: true,
    tenantId: true,
    permissions: { select: { key: true } },
  },
});

let inserted = 0;

for (const user of staffUsers) {
  const existing = new Set(user.permissions.map((permission) => permission.key));
  const implied = new Set(
    user.permissions.flatMap((permission) => legacyGrants[permission.key] ?? []),
  );
  const missing = [...implied].filter((key) => !existing.has(key));

  if (missing.length === 0) continue;

  const result = await prisma.userPermission.createMany({
    data: missing.map((key) => ({
      tenantId: user.tenantId,
      userId: user.id,
      key,
    })),
    skipDuplicates: true,
  });

  inserted += result.count;
}

await prisma.$disconnect();

console.log(`Backfilled ${inserted} staff permission records.`);
