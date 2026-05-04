-- AlterTable
ALTER TABLE "Session" ADD COLUMN "postponedTo" DATETIME;
ALTER TABLE "Session" ADD COLUMN "postponementDetails" TEXT;
ALTER TABLE "Session" ADD COLUMN "postponementReason" TEXT;
