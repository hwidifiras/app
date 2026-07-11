ALTER TABLE "ClubSettings"
ADD COLUMN "dashboardDefaultMode" TEXT NOT NULL DEFAULT 'AUTO',
ADD COLUMN "dashboardShowTodaySessions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowCashToday" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowDataConfidence" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowCashTrend" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowMembersOverview" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowDetailedDebts" BOOLEAN NOT NULL DEFAULT true;
