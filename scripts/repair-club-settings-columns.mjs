/**
 * Adds ClubSettings columns if missing on the configured DATABASE_URL.
 * Also repairs the legacy root dev.db when using prisma/dev.db in .env.development.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const alters = [
  `ALTER TABLE "ClubSettings" ADD COLUMN "clubName" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "ClubSettings" ADD COLUMN "clubLogoUrl" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "ClubSettings" ADD COLUMN "clubAddress" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "ClubSettings" ADD COLUMN "clubPhone" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "ClubSettings" ADD COLUMN "allowCheckInWithoutSubscription" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "ClubSettings" ADD COLUMN "debtAlertThresholdCents" INTEGER NOT NULL DEFAULT 0`,
];

async function repairDatabase(databaseUrl) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  console.log("\nRepairing:", databaseUrl);

  for (const sql of alters) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("  Added:", sql.match(/"(\w+)"/)?.[1] ?? sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log("  Exists:", sql.match(/"(\w+)"/)?.[1]);
      } else {
        console.error("  Failed:", msg);
        throw e;
      }
    }
  }

  await prisma.clubSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  const row = await prisma.clubSettings.findUnique({ where: { id: "default" } });
  console.log("  Verified clubName column:", row?.clubName ?? "(null)");
  await prisma.$disconnect();
}

async function main() {
  const primary = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  await repairDatabase(primary);

  const legacyPath = path.join(root, "dev.db");
  if (existsSync(legacyPath) && primary !== "file:./dev.db") {
    await repairDatabase("file:./dev.db");
  }

  console.log("\nClubSettings repair complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
