export type CoachDto = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  isActive: boolean;
  sportId: string | null;
  sportName: string | null;
  qualifiedSportIds: string[];
  qualifiedSports: Array<{ id: string; name: string; isPrimary: boolean }>;
  activeGroups: Array<{ id: string; name: string; sportName: string | null; room: string | null }>;
  activeGroupCount: number;
  weeklyScheduleCount: number;
  createdAt: string;
  updatedAt: string;
};
