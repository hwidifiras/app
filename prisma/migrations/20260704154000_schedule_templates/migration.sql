CREATE TABLE "ScheduleTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleTemplateSlot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "templateId" TEXT NOT NULL,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "startTime" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScheduleTemplateSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleTemplate_tenantId_name_key" ON "ScheduleTemplate"("tenantId", "name");
CREATE INDEX "ScheduleTemplate_tenantId_idx" ON "ScheduleTemplate"("tenantId");
CREATE UNIQUE INDEX "ScheduleTemplateSlot_tenantId_templateId_dayOfWeek_startTime_key" ON "ScheduleTemplateSlot"("tenantId", "templateId", "dayOfWeek", "startTime");
CREATE INDEX "ScheduleTemplateSlot_tenantId_idx" ON "ScheduleTemplateSlot"("tenantId");
CREATE INDEX "ScheduleTemplateSlot_templateId_idx" ON "ScheduleTemplateSlot"("templateId");

ALTER TABLE "ScheduleTemplate"
ADD CONSTRAINT "ScheduleTemplate_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleTemplateSlot"
ADD CONSTRAINT "ScheduleTemplateSlot_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleTemplateSlot"
ADD CONSTRAINT "ScheduleTemplateSlot_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ScheduleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
