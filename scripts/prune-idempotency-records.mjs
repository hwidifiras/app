import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const parsedBatchSize = Number.parseInt(process.env.IDEMPOTENCY_PRUNE_BATCH_SIZE ?? "1000", 10);
const batchSize = Number.isInteger(parsedBatchSize)
  ? Math.min(Math.max(parsedBatchSize, 1), 10_000)
  : 1_000;
const parsedMaxBatches = Number.parseInt(process.env.IDEMPOTENCY_PRUNE_MAX_BATCHES ?? "10", 10);
const maxBatches = Number.isInteger(parsedMaxBatches)
  ? Math.min(Math.max(parsedMaxBatches, 1), 100)
  : 10;

try {
  let totalDeleted = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const deleted = await prisma.$executeRaw`
      WITH expired AS (
        SELECT "id"
        FROM "IdempotencyRecord"
        WHERE "expiresAt" <= NOW()
        ORDER BY "expiresAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "IdempotencyRecord" AS record
      USING expired
      WHERE record."id" = expired."id"
    `;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }

  console.log(`Pruned ${totalDeleted} expired idempotency record(s).`);
} finally {
  await prisma.$disconnect();
}
