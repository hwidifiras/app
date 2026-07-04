-- Dojo v0: backfill sportId before NOT NULL constraints

-- ClubSettings default row
CREATE TABLE "ClubSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "allowCheckInWithPartialPayment" BOOLEAN NOT NULL DEFAULT true,
    "allowPublicRegister" BOOLEAN NOT NULL DEFAULT false,
    "maxStaffDiscountPercent" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "ClubSettings" ("id", "allowCheckInWithPartialPayment", "allowPublicRegister", "maxStaffDiscountPercent", "updatedAt")
VALUES ('default', 1, 0, 30, CURRENT_TIMESTAMP);

CREATE TABLE "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'OTHER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OfferApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "memberIds" TEXT NOT NULL,
    "subscriptionIds" TEXT NOT NULL,
    "quoteSnapshot" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfferApplication_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Backfill SubscriptionPlan.sportId from first Sport if NULL
UPDATE "SubscriptionPlan"
SET "sportId" = (SELECT "id" FROM "Sport" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "sportId" IS NULL;

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

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
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionPlan_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SubscriptionPlan" ("createdAt", "description", "id", "isActive", "name", "price", "sessionsPerWeek", "sportId", "totalSessions", "updatedAt", "validityDays")
SELECT "createdAt", "description", "id", "isActive", "name", "price", "sessionsPerWeek", COALESCE("sportId", (SELECT "id" FROM "Sport" ORDER BY "createdAt" ASC LIMIT 1)), "totalSessions", "updatedAt", "validityDays"
FROM "SubscriptionPlan";
DROP TABLE "SubscriptionPlan";
ALTER TABLE "new_SubscriptionPlan" RENAME TO "SubscriptionPlan";
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

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
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MemberSubscription_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MemberSubscription" ("amount", "createdAt", "endDate", "id", "memberId", "planId", "sportId", "remainingSessions", "startDate", "status", "updatedAt")
SELECT ms."amount", ms."createdAt", ms."endDate", ms."id", ms."memberId", ms."planId",
  COALESCE(sp."sportId", (SELECT "id" FROM "Sport" ORDER BY "createdAt" ASC LIMIT 1)),
  ms."remainingSessions", ms."startDate", ms."status", ms."updatedAt"
FROM "MemberSubscription" ms
LEFT JOIN "SubscriptionPlan" sp ON sp."id" = ms."planId";
DROP TABLE "MemberSubscription";
ALTER TABLE "new_MemberSubscription" RENAME TO "MemberSubscription";
CREATE INDEX "MemberSubscription_memberId_sportId_status_idx" ON "MemberSubscription"("memberId", "sportId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "HouseholdMember_memberId_key" ON "HouseholdMember"("memberId");
CREATE UNIQUE INDEX "HouseholdMember_householdId_memberId_key" ON "HouseholdMember"("householdId", "memberId");
