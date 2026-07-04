import { ScheduleTemplatesManager } from "@/components/settings/schedule-templates-manager";
import { PageHeader } from "@/components/ui/page-header";
import { getClubSettings } from "@/lib/club-settings";
import { toScheduleTemplateDto } from "@/lib/schedule-template-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsSchedulesPage() {
  const [templates, groups, sports, settings] = await Promise.all([
    prisma.scheduleTemplate.findMany({
      where: { isActive: true },
      include: { slots: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.group.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sportId: true,
        groupType: true,
        sport: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.sport.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getClubSettings(),
  ]);

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Configuration"
        title="Horaires & saisons"
        description="Creez des horaires types, puis appliquez-les a un groupe, une discipline ou toute une saison."
      />

      <ScheduleTemplatesManager
        initialTemplates={templates.map(toScheduleTemplateDto)}
        groups={groups.map((group) => ({
          id: group.id,
          name: group.name,
          sportId: group.sportId,
          sportName: group.sport.name,
          groupType: group.groupType,
        }))}
        sports={sports}
        workingDays={settings.workingDays}
      />
    </main>
  );
}
