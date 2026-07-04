import type { ScheduleTemplate, ScheduleTemplateSlot } from "@prisma/client";

import { WORKING_DAY_ORDER, type ClubDay } from "@/lib/club-working-days";

export type ScheduleTemplateWithSlots = ScheduleTemplate & {
  slots: ScheduleTemplateSlot[];
};

const dayRank = new Map<ClubDay, number>(WORKING_DAY_ORDER.map((day, index) => [day, index]));

export function sortTemplateSlots<T extends { dayOfWeek: string; startTime: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => {
    const dayDiff = (dayRank.get(a.dayOfWeek as ClubDay) ?? 99) - (dayRank.get(b.dayOfWeek as ClubDay) ?? 99);
    return dayDiff || a.startTime.localeCompare(b.startTime);
  });
}

export function toScheduleTemplateDto(template: ScheduleTemplateWithSlots) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    isActive: template.isActive,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    slots: sortTemplateSlots(template.slots).map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      durationMinutes: slot.durationMinutes,
    })),
  };
}

export function previousUtcDay(date: Date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}
