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

export type MemberStatusFilter = "ALL" | MemberWithGroups["status"];
export type MemberPaymentFilter = "ALL" | MemberWithGroups["paymentStatus"];
export type MemberViewMode = "LIST" | "GROUPED";

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

export function getMemberActiveFilterCount({
  statusFilter,
  paymentFilter,
  sportFilter,
  viewMode,
}: {
  statusFilter: MemberStatusFilter;
  paymentFilter: MemberPaymentFilter;
  sportFilter: string;
  viewMode: MemberViewMode;
}) {
  return [
    statusFilter !== "ALL",
    paymentFilter !== "ALL",
    sportFilter !== "ALL",
    viewMode !== "LIST",
  ].filter(Boolean).length;
}

export function filterMemberList({
  members,
  groupsOptions,
  searchTerm,
  statusFilter,
  paymentFilter,
  sportFilter,
}: {
  members: MemberWithGroups[];
  groupsOptions: GroupOption[];
  searchTerm: string;
  statusFilter: MemberStatusFilter;
  paymentFilter: MemberPaymentFilter;
  sportFilter: string;
}) {
  const query = searchTerm.trim().toLowerCase();

  return members.filter((member) => {
    const matchesSearch =
      !query ||
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) ||
      member.phone.toLowerCase().includes(query) ||
      (member.email?.toLowerCase() ?? "").includes(query);

    const matchesStatus = statusFilter === "ALL" || member.status === statusFilter;
    const matchesPayment = paymentFilter === "ALL" || member.paymentStatus === paymentFilter;
    const matchesSport =
      sportFilter === "ALL" ||
      member.groupIds.some((groupId) => groupsOptions.find((group) => group.id === groupId)?.sportId === sportFilter);

    return matchesSearch && matchesStatus && matchesPayment && matchesSport;
  });
}

export function groupMembersByGroup(members: MemberWithGroups[]) {
  return members.reduce((acc, member) => {
    if (member.groupIds.length === 0) {
      acc.set("UNASSIGNED", [...(acc.get("UNASSIGNED") ?? []), member]);
      return acc;
    }

    member.groupIds.forEach((groupId) => {
      const existing = acc.get(groupId) ?? [];
      acc.set(groupId, [...existing, member]);
    });

    return acc;
  }, new Map<string, MemberWithGroups[]>());
}

export function getMemberPage({
  members,
  currentPage,
  pageSize = MEMBER_LIST_PAGE_SIZE,
}: {
  members: MemberWithGroups[];
  currentPage: number;
  pageSize?: number;
}) {
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  const currentPageSafe = Math.min(currentPage, pageCount);
  const pageStart = (currentPageSafe - 1) * pageSize;

  return {
    pageCount,
    currentPageSafe,
    pageMembers: members.slice(pageStart, pageStart + pageSize),
  };
}
