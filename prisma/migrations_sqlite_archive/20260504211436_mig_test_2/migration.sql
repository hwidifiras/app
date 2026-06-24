-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "groupType" TEXT NOT NULL DEFAULT 'ADULTS',
    "sportId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "room" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Group_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("capacity", "coachId", "createdAt", "id", "isActive", "name", "room", "sportId", "updatedAt") SELECT "capacity", "coachId", "createdAt", "id", "isActive", "name", "room", "sportId", "updatedAt" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "memberType" TEXT NOT NULL DEFAULT 'NOT_SPECIFIED',
    "birthDate" DATETIME,
    "address" TEXT,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "parentAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Member" ("archivedAt", "createdAt", "email", "firstName", "id", "joinedAt", "lastName", "phone", "status", "updatedAt") SELECT "archivedAt", "createdAt", "email", "firstName", "id", "joinedAt", "lastName", "phone", "status", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_phone_key" ON "Member"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
