import { ScheduleTemplatesManager } from "@/components/settings/schedule-templates-manager";
import { SettingsMetric } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/ui/page-header";
import { CLUB_DAY_SHORT_LABELS } from "@/lib/club-working-days";
import { getClubSettings } from "@/lib/club-settings";
import { toScheduleTemplateDto } from "@/lib/schedule-template-utils";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsSchedulesPage() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Horaires"
          title="Horaires & saisons"
          description="Seul un administrateur peut gérer les modèles horaires."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const [templates, groups, sports, settings] = await Promise.all([
    prisma.scheduleTemplate.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      include: { slots: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.group.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
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
      where: { tenantId: authUser.tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getClubSettings(),
  ]);

  const templateDtos = templates.map(toScheduleTemplateDto);
  const totalSlots = templateDtos.reduce((sum, template) => sum + template.slots.length, 0);
  const workingDaysLabel = settings.workingDays.map((day) => CLUB_DAY_SHORT_LABELS[day]).join(", ");

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Horaires"
        title="Horaires & saisons"
        description="Créez des horaires types, prévisualisez l'impact, puis appliquez-les à un groupe, une discipline ou toute une saison."
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Modèles" value={templateDtos.length} detail={`${totalSlots} créneau${totalSlots > 1 ? "x" : ""} enregistrés`} />
        <SettingsMetric label="Groupes actifs" value={groups.length} detail="Cibles disponibles" />
        <SettingsMetric label="Disciplines" value={sports.length} detail="Application par sport" />
        <SettingsMetric label="Jours ouverts" value={`${settings.workingDays.length} jours`} detail={workingDaysLabel || "À définir"} />
      </section>

      <ScheduleTemplatesManager
        initialTemplates={templateDtos}
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
