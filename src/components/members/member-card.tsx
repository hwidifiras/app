import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getMemberPaymentBadge, type GroupOption, type MemberWithGroups } from "./member-list-model";

type MemberCardProps = {
  member: MemberWithGroups;
  groupsOptions: GroupOption[];
  selectable?: boolean;
  selected?: boolean;
  onToggleSelection?: (memberId: string) => void;
};

export function MemberCard({
  member,
  groupsOptions,
  selectable = false,
  selected = false,
  onToggleSelection,
}: MemberCardProps) {
  const memberName = `${member.firstName} ${member.lastName}`;
  const payment = getMemberPaymentBadge(member.paymentStatus);
  const groupNames = member.groupIds.map(
    (groupId) => groupsOptions.find((group) => group.id === groupId)?.name ?? "Groupe",
  );

  return (
    <li className="min-w-0">
      <article className="flex h-full min-w-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-panel)]">
        <div className="flex min-w-0 items-start gap-2.5">
          {selectable && onToggleSelection ? (
            <label className="-ml-1 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--surface-soft)]">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelection(member.id)}
                className="size-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="sr-only">Sélectionner {memberName}</span>
            </label>
          ) : null}

          <div className="min-w-0 flex-1">
            <Link
              href={`/members/${member.id}`}
              prefetch={false}
              className="inline-flex min-h-11 max-w-full items-center text-base font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline"
            >
              <span className="truncate">{memberName}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${payment.className}`}>
                {payment.label}
              </span>
              <StatusBadge
                variant={member.status === "ACTIVE" ? "success" : "muted"}
                className="px-2 py-0.5 text-[0.68rem]"
              >
                {member.status === "ACTIVE" ? "Actif" : "Résilié"}
              </StatusBadge>
            </div>
          </div>
        </div>

        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Téléphone</dt>
            <dd className="min-w-0 break-words text-right font-medium text-[var(--foreground)]">{member.phone}</dd>
          </div>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Groupe</dt>
            <dd className="min-w-0 truncate text-right font-medium text-[var(--foreground)]">
              {groupNames[0] ?? "Sans groupe"}
            </dd>
          </div>
        </dl>

        <details className="group mt-2 border-t border-[var(--border)] pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-soft)] [&::-webkit-details-marker]:hidden">
            Informations
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="grid gap-2 px-2 pb-2 pt-1 text-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Email</dt>
              <dd className="min-w-0 break-all text-right font-medium">{member.email ?? "—"}</dd>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Groupes</dt>
              <dd className="min-w-0 text-right font-medium">
                {groupNames.length > 0 ? groupNames.join(", ") : "Sans groupe"}
              </dd>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Inscrit le</dt>
              <dd className="font-medium">{new Date(member.createdAt).toLocaleDateString("fr-FR")}</dd>
            </div>
          </dl>
        </details>

        <Link
          href={`/members/${member.id}`}
          prefetch={false}
          className="btn btn-primary mt-3 min-h-11 w-full"
          aria-label={`Ouvrir le dossier de ${memberName}`}
        >
          Ouvrir le dossier
        </Link>
      </article>
    </li>
  );
}
