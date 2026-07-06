import { CLUB_DAY_LABELS, type ClubDay } from "@/lib/club-working-days";
import type { GroupTypeValue } from "@/lib/demographics";
import type { ApplyScheduleTemplateInput } from "@/lib/schemas/schedule-template";
import { sortTemplateSlots } from "@/lib/schedule-template-utils";

export function groupWhereFromTarget(data: {
  targetMode: "SELECTED_GROUPS" | "SPORT" | "GROUP_TYPE" | "ALL_ACTIVE";
  groupIds?: string[];
  sportId?: string;
  groupType?: GroupTypeValue;
}) {
  if (data.targetMode === "SELECTED_GROUPS") {
    return { id: { in: data.groupIds ?? [] }, isActive: true };
  }
  if (data.targetMode === "SPORT") {
    return { sportId: data.sportId, isActive: true };
  }
  if (data.targetMode === "GROUP_TYPE") {
    return { groupType: data.groupType, isActive: true };
  }
  return { isActive: true };
}

type TemplateSlotSource = {
  dayOfWeek: string;
  startTime: string;
};

type TemplateApplyGroupSource = {
  id: string;
  name: string;
  groupType: GroupTypeValue;
  sport: { name: string };
};

export function closedDayWarningsForTemplateSlots(slots: TemplateSlotSource[], workingDays: ClubDay[]) {
  const workingDaySet = new Set(workingDays);
  return sortTemplateSlots(slots)
    .filter((slot) => !workingDaySet.has(slot.dayOfWeek as ClubDay))
    .map((slot) => `${CLUB_DAY_LABELS[slot.dayOfWeek as ClubDay]} ${slot.startTime}`);
}

export function buildScheduleTemplateApplySummary(params: {
  template: { id: string; name: string; slots: TemplateSlotSource[] };
  data: Pick<ApplyScheduleTemplateInput, "replaceExisting">;
  groups: TemplateApplyGroupSource[];
  existingSchedulesToClose: number;
  futureSessionsCount: number;
  workingDays: ClubDay[];
  effectiveFrom: Date;
  effectiveTo: Date | null;
}) {
  const { template, data, groups, existingSchedulesToClose, futureSessionsCount, workingDays, effectiveFrom, effectiveTo } =
    params;

  return {
    templateId: template.id,
    templateName: template.name,
    targetGroups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      sportName: group.sport.name,
      groupType: group.groupType,
    })),
    groupCount: groups.length,
    slotCount: template.slots.length,
    newScheduleCount: groups.length * template.slots.length,
    closedScheduleCount: data.replaceExisting ? existingSchedulesToClose : 0,
    futureSessionsCount,
    closedDayWarnings: closedDayWarningsForTemplateSlots(template.slots, workingDays),
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: effectiveTo?.toISOString() ?? null,
  };
}
