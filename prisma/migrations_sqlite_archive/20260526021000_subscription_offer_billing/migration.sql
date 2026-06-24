-- AlterTable
ALTER TABLE "MemberSubscription" ADD COLUMN "listPriceCents" INTEGER;
ALTER TABLE "MemberSubscription" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MemberSubscription" ADD COLUMN "offerApplicationId" TEXT;
ALTER TABLE "MemberSubscription" ADD COLUMN "offerName" TEXT;
