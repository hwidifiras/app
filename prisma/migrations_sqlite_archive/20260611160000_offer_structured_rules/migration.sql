-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "percentOff" INTEGER;
ALTER TABLE "Offer" ADD COLUMN "amountOffCents" INTEGER;
ALTER TABLE "Offer" ADD COLUMN "bundlePriceCents" INTEGER;
ALTER TABLE "Offer" ADD COLUMN "minMembers" INTEGER;
ALTER TABLE "Offer" ADD COLUMN "requiresHousehold" BOOLEAN;
ALTER TABLE "Offer" ADD COLUMN "maxMembers" INTEGER;
ALTER TABLE "Offer" ADD COLUMN "sportId" TEXT;
