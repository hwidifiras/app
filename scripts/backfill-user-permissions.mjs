import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const keys = [
  "members.manage",
  "enrollment.manage",
  "attendance.manage",
  "payments.manage",
  "catalog.manage",
  "offers.manage",
];

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
  const missing = keys.filter((key) => !existing.has(key));

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
