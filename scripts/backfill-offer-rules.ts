import { PrismaClient } from "@prisma/client";

import {
  backfillStructuredFieldsFromLegacyRules,
  offerNeedsStructuredBackfill,
} from "../src/lib/offer-rules";

const prisma = new PrismaClient();

const offers = await prisma.offer.findMany({ orderBy: { createdAt: "asc" } });

let updated = 0;
let skipped = 0;
let failed = 0;

for (const offer of offers) {
  if (!offerNeedsStructuredBackfill(offer)) {
    skipped++;
    continue;
  }

  const backfill = backfillStructuredFieldsFromLegacyRules(offer);
  if (!backfill) {
    failed++;
    console.error(`[skip] ${offer.id} · ${offer.name} (${offer.kind}) — invalid legacy rules`);
    continue;
  }

  await prisma.offer.update({
    where: { id: offer.id },
    data: backfill,
  });

  updated++;
  console.log(`[ok] ${offer.id} · ${offer.name} (${offer.kind})`);
}

console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed} total=${offers.length}`);

await prisma.$disconnect();
