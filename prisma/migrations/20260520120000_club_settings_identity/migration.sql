-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN "clubName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClubSettings" ADD COLUMN "clubAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClubSettings" ADD COLUMN "clubPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClubSettings" ADD COLUMN "allowCheckInWithoutSubscription" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ClubSettings" ADD COLUMN "debtAlertThresholdCents" INTEGER NOT NULL DEFAULT 0;
