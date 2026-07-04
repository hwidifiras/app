-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClubSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "allowCheckInWithPartialPayment" BOOLEAN NOT NULL DEFAULT true,
    "allowPublicRegister" BOOLEAN NOT NULL DEFAULT false,
    "maxStaffDiscountPercent" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ClubSettings" ("allowCheckInWithPartialPayment", "allowPublicRegister", "id", "maxStaffDiscountPercent", "updatedAt") SELECT "allowCheckInWithPartialPayment", "allowPublicRegister", "id", "maxStaffDiscountPercent", "updatedAt" FROM "ClubSettings";
DROP TABLE "ClubSettings";
ALTER TABLE "new_ClubSettings" RENAME TO "ClubSettings";
CREATE TABLE "new_Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Household" ("createdAt", "id", "label", "updatedAt") SELECT "createdAt", "id", "label", "updatedAt" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
CREATE TABLE "new_MemberSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "amount" INTEGER NOT NULL,
    "remainingSessions" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MemberSubscription_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MemberSubscription" ("amount", "createdAt", "endDate", "id", "memberId", "planId", "remainingSessions", "sportId", "startDate", "status", "updatedAt") SELECT "amount", "createdAt", "endDate", "id", "memberId", "planId", "remainingSessions", "sportId", "startDate", "status", "updatedAt" FROM "MemberSubscription";
DROP TABLE "MemberSubscription";
ALTER TABLE "new_MemberSubscription" RENAME TO "MemberSubscription";
CREATE INDEX "MemberSubscription_memberId_sportId_status_idx" ON "MemberSubscription"("memberId", "sportId", "status");
CREATE TABLE "new_Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Offer" ("createdAt", "createdById", "description", "id", "isActive", "kind", "name", "rules", "updatedAt") SELECT "createdAt", "createdById", "description", "id", "isActive", "kind", "name", "rules", "updatedAt" FROM "Offer";
DROP TABLE "Offer";
ALTER TABLE "new_Offer" RENAME TO "Offer";
CREATE TABLE "new_SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER,
    "validityDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionPlan_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SubscriptionPlan" ("createdAt", "description", "id", "isActive", "name", "price", "sessionsPerWeek", "sportId", "totalSessions", "updatedAt", "validityDays") SELECT "createdAt", "description", "id", "isActive", "name", "price", "sessionsPerWeek", "sportId", "totalSessions", "updatedAt", "validityDays" FROM "SubscriptionPlan";
DROP TABLE "SubscriptionPlan";
ALTER TABLE "new_SubscriptionPlan" RENAME TO "SubscriptionPlan";
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Existing staff accounts keep full staff access after this migration.
INSERT INTO "UserPermission" ("id", "userId", "key")
SELECT "id" || ':members.manage', "id", 'members.manage' FROM "User" WHERE "role" = 'STAFF';
INSERT INTO "UserPermission" ("id", "userId", "key")
SELECT "id" || ':enrollment.manage', "id", 'enrollment.manage' FROM "User" WHERE "role" = 'STAFF';
INSERT INTO "UserPermission" ("id", "userId", "key")
SELECT "id" || ':attendance.manage', "id", 'attendance.manage' FROM "User" WHERE "role" = 'STAFF';
INSERT INTO "UserPermission" ("id", "userId", "key")
SELECT "id" || ':payments.manage', "id", 'payments.manage' FROM "User" WHERE "role" = 'STAFF';
INSERT INTO "UserPermission" ("id", "userId", "key")
SELECT "id" || ':catalog.manage', "id", 'catalog.manage' FROM "User" WHERE "role" = 'STAFF';
INSERT INTO "UserPermission" ("id", "userId", "key")
SELECT "id" || ':offers.manage', "id", 'offers.manage' FROM "User" WHERE "role" = 'STAFF';

-- CreateIndex
CREATE INDEX "UserPermission_key_idx" ON "UserPermission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_key_key" ON "UserPermission"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
