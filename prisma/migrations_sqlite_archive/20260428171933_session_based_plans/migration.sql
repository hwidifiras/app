/*
  Warnings:

  - You are about to drop the column `durationDays` on the `SubscriptionPlan` table. All the data in the column will be lost.
  - Added the required column `remainingSessions` to the `MemberSubscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSessions` to the `SubscriptionPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `validityDays` to the `SubscriptionPlan` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberSubscriptionId" TEXT,
    "status" TEXT NOT NULL,
    "overrideReason" TEXT,
    "checkedBy" TEXT,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_memberSubscriptionId_fkey" FOREIGN KEY ("memberSubscriptionId") REFERENCES "MemberSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkedAt", "checkedBy", "createdAt", "id", "memberId", "overrideReason", "sessionId", "status", "updatedAt") SELECT "checkedAt", "checkedBy", "createdAt", "id", "memberId", "overrideReason", "sessionId", "status", "updatedAt" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE UNIQUE INDEX "Attendance_sessionId_memberId_key" ON "Attendance"("sessionId", "memberId");
CREATE TABLE "new_MemberSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "amount" INTEGER NOT NULL,
    "remainingSessions" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MemberSubscription" ("amount", "createdAt", "endDate", "id", "memberId", "planId", "startDate", "status", "updatedAt") SELECT "amount", "createdAt", "endDate", "id", "memberId", "planId", "startDate", "status", "updatedAt" FROM "MemberSubscription";
DROP TABLE "MemberSubscription";
ALTER TABLE "new_MemberSubscription" RENAME TO "MemberSubscription";
CREATE TABLE "new_SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER,
    "validityDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SubscriptionPlan" ("createdAt", "description", "id", "isActive", "name", "price", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "price", "updatedAt" FROM "SubscriptionPlan";
DROP TABLE "SubscriptionPlan";
ALTER TABLE "new_SubscriptionPlan" RENAME TO "SubscriptionPlan";
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
