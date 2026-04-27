export type CoachDto = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  sportId: string | null;
  sportName: string | null;
  createdAt: string;
  updatedAt: string;
};
