import type { MemberDirectoryRow } from "@/lib/member-directory";

export type GroupOption = {
  id: string;
  name: string;
  sportId: string;
};

export type SportOption = {
  id: string;
  name: string;
};

export type MemberWithGroups = MemberDirectoryRow;

export type MemberStatusFilter = "ALL" | MemberWithGroups["status"];
export type MemberPaymentFilter = "ALL" | MemberWithGroups["paymentStatus"];
export type MemberViewMode = "LIST" | "GROUPED";

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
