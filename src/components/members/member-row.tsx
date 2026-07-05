import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getMemberPaymentBadge, type GroupOption, type MemberWithGroups } from "./member-list-model";

type MemberRowProps = {
  member: MemberWithGroups;
  groupsOptions: GroupOption[];
  selectable?: boolean;
  selected: boolean;
  expanded: boolean;
  onToggleSelection: (memberId: string) => void;
  onToggleExpand: (memberId: string) => void;
};

export function MemberRow({
  member,
  groupsOptions,
  selectable = false,
  selected,
  expanded,
  onToggleSelection,
  onToggleExpand,
}: MemberRowProps) {
  const payment = getMemberPaymentBadge(member.paymentStatus);
  const firstGroupName =
    member.groupIds.length > 0
      ? groupsOptions.find((group) => group.id === member.groupIds[0])?.name ?? "Groupe"
      : "Sans groupe";

  return (
    <tr
      className={`mobile-collapsible-row transition-colors hover:bg-[var(--surface-soft)] ${
        expanded ? "is-expanded" : ""
      }`}
    >
      {selectable ? (
        <td className="hidden px-4 py-3 align-top sm:table-cell">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelection(member.id)}
            className="size-4 rounded border-border text-primary focus:ring-primary"
            aria-label={`Sélectionner ${member.firstName} ${member.lastName}`}
          />
        </td>
      ) : null}
      <td className="data-table-primary px-4 py-3 font-medium" data-label="Nom">
        <Link
          href={`/members/${member.id}`}
          prefetch={false}
          className="text-foreground hover:text-[var(--primary)] hover:underline"
        >
          {member.firstName} {member.lastName}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
          <span className="chip chip-muted px-1.5 py-0.5 text-[10px]">{member.phone}</span>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${payment.className}`}
          >
            {payment.label}
          </span>
          <StatusBadge
            variant={member.status === "ACTIVE" ? "success" : "muted"}
            className="px-1.5 py-0.5 text-[10px]"
          >
            {member.status === "ACTIVE" ? "Actif" : "Résilié"}
          </StatusBadge>
          <span className="chip chip-muted max-w-full truncate px-1.5 py-0.5 text-[10px]">{firstGroupName}</span>
        </div>
      </td>
      <td className="px-4 py-3 mobile-detail-cell" data-label="Téléphone">
        {member.phone}
      </td>
      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell mobile-detail-cell" data-label="Email">
        {member.email ?? "-"}
      </td>
      <td className="hidden px-4 py-3 lg:table-cell mobile-detail-cell" data-label="Groupes">
        {member.groupIds.length === 0 ? (
          <span className="text-xs text-muted-foreground">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {member.groupIds.map((groupId) => {
              const groupName = groupsOptions.find((group) => group.id === groupId)?.name ?? groupId.slice(0, 6);
              return (
                <span key={groupId} className="chip chip-muted px-1.5 py-0.5 text-[10px]">
                  {groupName}
                </span>
              );
            })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 mobile-detail-cell" data-label="Paiement">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${payment.className}`}>
          {payment.label}
        </span>
      </td>
      <td className="px-4 py-3 mobile-detail-cell" data-label="Statut">
        <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
          {member.status === "ACTIVE" ? "Actif" : "Résilié"}
        </StatusBadge>
      </td>
      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell mobile-detail-cell" data-label="Inscrit le">
        {new Date(member.createdAt).toLocaleDateString("fr-FR")}
      </td>
      <td className="card-actions-cell px-4 py-3 text-right" data-label="Actions">
        <Link href={`/members/${member.id}`} prefetch={false} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
          Ouvrir
        </Link>
      </td>
      <td className="px-4 py-3 text-center md:hidden mobile-toggle-cell">
        <button
          type="button"
          className="mobile-card-toggle w-full"
          onClick={() => onToggleExpand(member.id)}
          aria-expanded={expanded}
        >
          {expanded ? "Réduire" : "Infos"}
          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </td>
    </tr>
  );
}
