export type MemberDto = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: "ACTIVE" | "ARCHIVED";
  joinedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
