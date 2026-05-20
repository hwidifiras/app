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

for (const key of keys) {
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "UserPermission" ("id", "userId", "key")
     SELECT "id" || ':${key}', "id", '${key}' FROM "User" WHERE "role" = 'STAFF'`,
  );
}

await prisma.$disconnect();
