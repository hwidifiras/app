-- Add append-only ledger metadata to existing payment rows.
ALTER TABLE "Payment" ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'PAYMENT';
ALTER TABLE "Payment" ADD COLUMN "correctsPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "correctionReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Payment_correctsPaymentId_idx" ON "Payment"("correctsPaymentId");
CREATE INDEX "Payment_createdById_idx" ON "Payment"("createdById");
