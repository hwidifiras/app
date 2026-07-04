-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClubSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "clubName" TEXT NOT NULL DEFAULT '',
    "clubLogoUrl" TEXT NOT NULL DEFAULT '',
    "clubAddress" TEXT NOT NULL DEFAULT '',
    "clubPhone" TEXT NOT NULL DEFAULT '',
    "allowCheckInWithPartialPayment" BOOLEAN NOT NULL DEFAULT true,
    "allowCheckInWithoutSubscription" BOOLEAN NOT NULL DEFAULT false,
    "absentConsumesSession" BOOLEAN NOT NULL DEFAULT true,
    "allowPublicRegister" BOOLEAN NOT NULL DEFAULT false,
    "maxStaffDiscountPercent" INTEGER NOT NULL DEFAULT 30,
    "debtAlertThresholdCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ClubSettings" ("allowCheckInWithPartialPayment", "allowCheckInWithoutSubscription", "allowPublicRegister", "clubAddress", "clubLogoUrl", "clubName", "clubPhone", "debtAlertThresholdCents", "id", "maxStaffDiscountPercent", "updatedAt") SELECT "allowCheckInWithPartialPayment", "allowCheckInWithoutSubscription", "allowPublicRegister", "clubAddress", "clubLogoUrl", "clubName", "clubPhone", "debtAlertThresholdCents", "id", "maxStaffDiscountPercent", "updatedAt" FROM "ClubSettings";
DROP TABLE "ClubSettings";
ALTER TABLE "new_ClubSettings" RENAME TO "ClubSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
