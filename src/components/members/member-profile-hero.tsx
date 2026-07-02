import Link from "next/link";
import { Archive, Banknote, CreditCard, Phone, Mail, User, UsersRound } from "lucide-react";

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
  activeSubscriptionLabel: string;
  remainingSessionsLabel: string;
  lastAttendanceLabel: string;
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
  activeSubscriptionLabel,
  remainingSessionsLabel,
  lastAttendanceLabel,
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

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Solde</p>
                <p className={`mt-1 text-sm font-bold ${totalDebtCents > 0 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                  {totalDebtCents > 0 ? formatMoney(totalDebtCents) : "Soldé"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Abonnement</p>
                <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">{activeSubscriptionLabel}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Séances</p>
                <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">{remainingSessionsLabel}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Dernier pointage</p>
                <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">{lastAttendanceLabel}</p>
              </div>
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
                  <Link href={`/subscriptions/new?memberId=${member.id}`} className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
                    <CreditCard className="size-4" />
                    Renouveler
                  </Link>
                  <Link href={`/members/${member.id}/add-to-group`} className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
                    <UsersRound className="size-4" />
                    Affecter
                  </Link>
                  <Link href="#member-danger" className="btn btn-ghost btn-block-mobile min-h-11 border-[var(--danger)]/30 text-[var(--danger)] sm:w-auto">
                    <Archive className="size-4" />
                    Archiver
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm xl:block">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Dossier</p>
          <p className="mt-1 font-bold text-[var(--foreground)]">
            {activeSubscriptionsCount} abo · {activeGroupsCount} cours
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {totalDebtCents > 0 ? "Action recommandée : encaisser" : "Aucun solde à traiter"}
          </p>
          </div>
      </div>
    </section>
  );
}
