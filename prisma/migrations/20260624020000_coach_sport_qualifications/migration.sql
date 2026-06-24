CREATE TABLE "CoachSportQualification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "coachId" TEXT NOT NULL,
  "sportId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CoachSportQualification_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CoachSportQualification_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "CoachSportQualification" ("id", "coachId", "sportId", "isPrimary", "createdAt", "updatedAt")
SELECT
  'cq_' || "id" || '_' || "sportId",
  "id",
  "sportId",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Coach"
WHERE "sportId" IS NOT NULL;

CREATE UNIQUE INDEX "CoachSportQualification_coachId_sportId_key" ON "CoachSportQualification"("coachId", "sportId");
CREATE INDEX "CoachSportQualification_sportId_idx" ON "CoachSportQualification"("sportId");
