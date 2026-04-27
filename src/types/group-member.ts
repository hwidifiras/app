export type GroupMemberStatusDto = "ACTIVE" | "INACTIVE";

export type GroupMemberDto = {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  startDate: string;
  endDate: string | null;
  status: GroupMemberStatusDto;
  createdAt: string;
  updatedAt: string;
};
