import {
  checkGroupMemberCompatibility,
  genderLabel,
  groupGenderPolicyLabel,
  groupTypeLabel,
  memberTypeLabel,
  type GenderValue,
  type GroupGenderPolicyValue,
  type GroupTypeValue,
  type MemberTypeValue,
} from "@/lib/demographics";

export type MemberType = MemberTypeValue;
export type GroupType = GroupTypeValue;
export type Gender = GenderValue;
export type GroupGenderPolicy = GroupGenderPolicyValue;

export type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  memberType: MemberType;
  gender: Gender;
};

export type GroupOption = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  groupType: GroupType;
  genderPolicy: GroupGenderPolicy;
  capacity: number;
  activeMembers: number;
};

export type PlanOption = {
  id: string;
  name: string;
  price: number;
  sportId: string;
  sportName: string;
};

export type LineState = {
  key: string;
  mode: "existing" | "new";
  memberId: string;
  newFirstName: string;
  newLastName: string;
  newPhone: string;
  memberType: MemberType;
  gender: Gender;
  parentName: string;
  parentPhone: string;
  parentAddress: string;
  groupId: string;
  planId: string;
  paymentCents: string;
  paymentMethod: string;
};

export function lineMemberProfile(
  line: LineState,
  members: MemberOption[],
): { memberType: MemberType; gender: Gender } | null {
  if (line.mode === "new") return { memberType: line.memberType, gender: line.gender };
  if (!line.memberId) return null;
  const member = members.find((item) => item.id === line.memberId);
  return member ? { memberType: member.memberType, gender: member.gender } : null;
}

export function lineCompatibilityIssue(line: LineState, members: MemberOption[], groups: GroupOption[]) {
  if (!line.groupId) return null;
  const group = groups.find((item) => item.id === line.groupId);
  const memberProfile = lineMemberProfile(line, members);
  if (!group || !memberProfile) {
    return null;
  }
  const compatibility = checkGroupMemberCompatibility({
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    memberType: memberProfile.memberType,
    gender: memberProfile.gender,
  });
  if (compatibility.ok) return null;
  return `Profil incompatible: membre ${memberTypeLabel(memberProfile.memberType)} / ${genderLabel(memberProfile.gender)} avec cours ${groupTypeLabel(group.groupType)} / ${groupGenderPolicyLabel(group.genderPolicy)}.`;
}

export function isGroupCompatibleWithLine(line: LineState, members: MemberOption[], group: GroupOption) {
  const memberProfile = lineMemberProfile(line, members);
  if (!memberProfile) return true;
  return checkGroupMemberCompatibility({
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    memberType: memberProfile.memberType,
    gender: memberProfile.gender,
  }).ok;
}

export function newEnrollmentLine(memberId = ""): LineState {
  return {
    key: crypto.randomUUID(),
    mode: "existing",
    memberId,
    newFirstName: "",
    newLastName: "",
    newPhone: "",
    memberType: "NOT_SPECIFIED",
    gender: "NOT_SPECIFIED",
    parentName: "",
    parentPhone: "",
    parentAddress: "",
    groupId: "",
    planId: "",
    paymentCents: "",
    paymentMethod: "CASH",
  };
}
