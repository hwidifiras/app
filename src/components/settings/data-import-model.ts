import type { GroupTypeValue } from "@/lib/demographics";

export type GroupOption = {
  id: string;
  name: string;
  groupType: GroupTypeValue;
  sportId: string;
  sportName: string;
};

export type PlanOption = {
  id: string;
  name: string;
  sportId: string;
  price: number;
  totalSessions: number;
  validityDays: number;
};

export type SessionOption = {
  id: string;
  groupId: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
};

export type DataImportPreview = {
  memberPhone: string;
  memberName: string;
  groupName: string;
  planName: string;
  sportName: string;
  remainingBalanceCents: number;
  attendanceCount: number;
  warnings: string[];
};

export const DATA_IMPORT_TODAY = new Date().toISOString().slice(0, 10);
export const DATA_IMPORT_TEMPLATE_URL = "/templates/we-discipline-reprise-membres.xlsx";

export function isoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function moneyInputToCents(value: string) {
  return Math.round((Number.parseFloat(value.replace(",", ".")) || 0) * 100);
}
