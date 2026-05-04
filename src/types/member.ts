export type MemberDto = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
  birthDate: string | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  status: "ACTIVE" | "ARCHIVED";
  joinedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
