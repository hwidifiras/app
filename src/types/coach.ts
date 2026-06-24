export type CoachDto = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  sportId: string | null;
  sportName: string | null;
  qualifiedSportIds: string[];
  qualifiedSports: Array<{ id: string; name: string; isPrimary: boolean }>;
  createdAt: string;
  updatedAt: string;
};
