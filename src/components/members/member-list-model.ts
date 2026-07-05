export type GroupOption = {
  id: string;
  name: string;
  sportId: string;
};

export type SportOption = {
  id: string;
  name: string;
};

export type MemberWithGroups = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
  gender: "MALE" | "FEMALE" | "NOT_SPECIFIED";
  birthDate: string | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  status: "ACTIVE" | "ARCHIVED";
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  joinedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  groupIds: string[];
};

export const MEMBER_LIST_PAGE_SIZE = 10;

export function getMemberPaymentBadge(status: MemberWithGroups["paymentStatus"]) {
  if (status === "PAID") return { label: "Payé", className: "bg-emerald-100 text-emerald-700" };
  if (status === "PARTIAL") return { label: "Partiel", className: "bg-amber-100 text-amber-700" };
  return { label: "Non payé", className: "bg-rose-100 text-rose-700" };
}

export function getGroupLabel(groupId: string, groupsOptions: GroupOption[]) {
  if (groupId === "UNASSIGNED") return "Sans groupe";
  return groupsOptions.find((group) => group.id === groupId)?.name ?? "Groupe";
}
