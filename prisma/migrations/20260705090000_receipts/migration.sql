-- Receipt settings for each tenant's club profile.
ALTER TABLE "ClubSettings"
ADD COLUMN "receiptPrefix" TEXT NOT NULL DEFAULT 'WD',
ADD COLUMN "nextReceiptSequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "receiptFooter" TEXT NOT NULL DEFAULT '',
ADD COLUMN "receiptEmailDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receiptPrintDefault" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'VOIDED');

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "paymentId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "verificationCode" TEXT NOT NULL,
  "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "snapshotJson" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");
CREATE UNIQUE INDEX "Receipt_tenantId_receiptNumber_key" ON "Receipt"("tenantId", "receiptNumber");
CREATE INDEX "Receipt_tenantId_idx" ON "Receipt"("tenantId");
CREATE INDEX "Receipt_verificationCode_idx" ON "Receipt"("verificationCode");
CREATE INDEX "Receipt_issuedById_idx" ON "Receipt"("issuedById");

ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
