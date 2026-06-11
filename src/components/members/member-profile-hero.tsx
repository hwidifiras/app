import Link from "next/link";
import { Banknote, Phone, Mail, User } from "lucide-react";

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
    <section className="panel overflow-hidden md:col-span-3">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold shadow-md sm:size-20 sm:text-2xl"
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
                  Parent : {member.parentName}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center min-w-[5.5rem]">
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Abos</p>
            <p className="text-lg font-bold text-[var(--foreground)]">{activeSubscriptionsCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center min-w-[5.5rem]">
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Groupes</p>
            <p className="text-lg font-bold text-[var(--foreground)]">{activeGroupsCount}</p>
          </div>
          <div
            className={`rounded-xl border px-3 py-2 text-center min-w-[6.5rem] ${
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
          {totalDebtCents > 0 ? (
            <Link
              href={`/payments/new?memberId=${member.id}`}
              className="btn btn-primary inline-flex items-center gap-2 self-center"
            >
              <Banknote className="size-4" />
              Encaisser
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
