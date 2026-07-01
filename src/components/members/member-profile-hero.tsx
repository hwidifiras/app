import Link from "next/link";
import { Banknote, Phone, Mail, User, UserPlus, UsersRound } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getMemberAvatarStyle, getMemberInitials } from "@/lib/member-avatar";
import { formatMoney } from "@/lib/subscription-billing";

type MemberProfileHeroProps = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
    status: "ACTIVE" | "ARCHIVED";
    joinedAt: Date;
    parentName: string | null;
    parentPhone: string | null;
  };
  totalDebtCents: number;
  activeSubscriptionsCount: number;
  activeGroupsCount: number;
};

function memberTypeLabel(value: MemberProfileHeroProps["member"]["memberType"]) {
  if (value === "KID") return "Enfant";
  if (value === "ADULT") return "Adulte";
  return "Non spécifié";
}

export function MemberProfileHero({
  member,
  totalDebtCents,
  activeSubscriptionsCount,
  activeGroupsCount,
}: MemberProfileHeroProps) {
  const initials = getMemberInitials(member.firstName, member.lastName);
  const avatarStyle = getMemberAvatarStyle(member.id);
  const displayPhone =
    member.memberType === "KID" && member.parentPhone?.trim()
      ? member.parentPhone
      : member.phone;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-5 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-lg text-lg font-bold shadow-[var(--shadow-panel)] sm:size-16 sm:text-xl"
            style={avatarStyle}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                {member.firstName} {member.lastName}
              </h1>
              <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                {member.status === "ACTIVE" ? "Actif" : "Archivé"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {memberTypeLabel(member.memberType)} · Inscrit le{" "}
              {member.joinedAt.toLocaleDateString("fr-FR")}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                {displayPhone}
              </span>
              {member.email ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </span>
              ) : null}
              {member.memberType === "KID" && member.parentName ? (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5 shrink-0" />
                  Parent: {member.parentName}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={`/payments/new?memberId=${member.id}`}
                className={`btn btn-block-mobile min-h-11 sm:w-auto ${
                  totalDebtCents > 0 ? "btn-primary" : "btn-ghost"
                }`}
              >
                <Banknote className="size-4" />
                Encaisser
              </Link>
              {member.status === "ACTIVE" ? (
                <>
                  <Link href={`/enrollment?memberId=${member.id}`} className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
                    <UserPlus className="size-4" />
                    Inscrire
                  </Link>
                  <Link href={`/members/${member.id}/add-to-group`} className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
                    <UsersRound className="size-4" />
                    Affecter
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 xl:flex xl:justify-end">
          <div className="min-w-[5.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center">
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Abos</p>
            <p className="text-lg font-bold text-[var(--foreground)]">{activeSubscriptionsCount}</p>
          </div>
          <div className="min-w-[5.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center">
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Cours</p>
            <p className="text-lg font-bold text-[var(--foreground)]">{activeGroupsCount}</p>
          </div>
          <div
            className={`min-w-[6.5rem] rounded-lg border px-3 py-2 text-center ${
              totalDebtCents > 0
                ? "border-[var(--warning)]/30 bg-[var(--warning)]/10"
                : "border-[var(--border)] bg-[var(--surface-soft)]"
            }`}
          >
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Solde</p>
            <p
              className={`text-lg font-bold ${
                totalDebtCents > 0 ? "text-[var(--warning)]" : "text-[var(--success)]"
              }`}
            >
              {totalDebtCents > 0 ? formatMoney(totalDebtCents) : "Soldé"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
