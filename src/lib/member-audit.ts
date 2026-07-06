export type MemberAuditSource = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  memberType: string;
  gender: string;
  birthDate: Date | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  status: string;
  joinedAt: Date;
  archivedAt: Date | null;
};

export const memberAuditSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  memberType: true,
  gender: true,
  birthDate: true,
  address: true,
  parentName: true,
  parentPhone: true,
  parentAddress: true,
  status: true,
  joinedAt: true,
  archivedAt: true,
} as const;

export function memberAuditSnapshot(member: MemberAuditSource) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    email: member.email,
    memberType: member.memberType,
    gender: member.gender,
    birthDate: member.birthDate?.toISOString() ?? null,
    address: member.address,
    parentName: member.parentName,
    parentPhone: member.parentPhone,
    parentAddress: member.parentAddress,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    archivedAt: member.archivedAt?.toISOString() ?? null,
  };
}
