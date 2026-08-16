ALTER TABLE "TenantOnboarding"
  ADD COLUMN "selectedDisciplineNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
