import Link from "next/link";
import {
  Activity,
  Archive,
  Banknote,
  CalendarClock,
  CreditCard,
  Dumbbell,
  Mail,
  Phone,
  PlayCircle,
  User,
  UsersRound,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getMemberAvatarStyle, getMemberInitials } from "@/lib/member-avatar";
import { formatMoney } from "@/lib/subscription-billing";

export type MemberProfileActionKind =
  | "COLLECT"
  | "RENEW"
  | "ASSIGN_CLASS"
  | "GYM_CHECK_IN"
  | "RESUME"
  | "ARCHIVE";

export type MemberProfileAction = {
  kind: MemberProfileActionKind;
  label: string;
  href: string;
};

type MemberProfileHeroProps = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
    gender: "MALE" | "FEMALE" | "NOT_SPECIFIED";
    status: "ACTIVE" | "ARCHIVED";
    joinedAt: Date;
    parentName: string | null;
    parentPhone: string | null;
  };
  totalDebtCents: number;
  activeSubscriptionsCount: number;
  activityScopeLabel: string;
  subscriptionLabel: string;
  classRightsLabel: string | null;
  gymAccessLabel: string | null;
  validityLabel: string;
  lastActivityLabel: string;
  actions: MemberProfileAction[];
  recommendedActionKind: MemberProfileActionKind | null;
};

const actionIcons = {
  COLLECT: Banknote,
  RENEW: CreditCard,
  ASSIGN_CLASS: UsersRound,
  GYM_CHECK_IN: Dumbbell,
  RESUME: PlayCircle,
  ARCHIVE: Archive,
} satisfies Record<MemberProfileActionKind, typeof Banknote>;

function memberTypeLabel(value: MemberProfileHeroProps["member"]["memberType"]) {
  if (value === "KID") return "Enfant";
  if (value === "ADULT") return "Adulte";
  return "Non spécifié";
}

function genderLabel(value: MemberProfileHeroProps["member"]["gender"]) {
  if (value === "MALE") return "Garçon / homme";
  if (value === "FEMALE") return "Fille / femme";
  return "Non spécifié";
}

export function MemberProfileHero({
  member,
  totalDebtCents,
  activeSubscriptionsCount,
  activityScopeLabel,
  subscriptionLabel,
  classRightsLabel,
  gymAccessLabel,
  validityLabel,
  lastActivityLabel,
  actions,
  recommendedActionKind,
}: MemberProfileHeroProps) {
  const initials = getMemberInitials(member.firstName, member.lastName);
  const avatarStyle = getMemberAvatarStyle(member.id);
  const displayPhone =
    member.memberType === "KID" && member.parentPhone?.trim()
      ? member.parentPhone
      : member.phone;
  const recommendedAction = actions.find((action) => action.kind === recommendedActionKind) ?? null;
  const healthItems = [
    {
      label: "Solde",
      value: totalDebtCents > 0 ? formatMoney(totalDebtCents) : "Soldé",
      icon: Banknote,
      tone: totalDebtCents > 0 ? "text-[var(--warning)]" : "text-[var(--success)]",
    },
    { label: "Abonnement", value: subscriptionLabel, icon: CreditCard, tone: "text-[var(--foreground)]" },
    ...(classRightsLabel
      ? [{ label: "Cours", value: classRightsLabel, icon: UsersRound, tone: "text-[var(--foreground)]" }]
      : []),
    ...(gymAccessLabel
      ? [{ label: "Salle", value: gymAccessLabel, icon: Dumbbell, tone: "text-[var(--foreground)]" }]
      : []),
    { label: "Échéance", value: validityLabel, icon: CalendarClock, tone: "text-[var(--foreground)]" },
    { label: "Activité récente", value: lastActivityLabel, icon: Activity, tone: "text-[var(--foreground)]" },
  ];

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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                {member.firstName} {member.lastName}
              </h1>
              <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                {member.status === "ACTIVE" ? "Actif" : "Archivé"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {memberTypeLabel(member.memberType)} · {genderLabel(member.gender)} · Inscrit le{" "}
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

            <div className="mt-4 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr))]">
              {healthItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                      <Icon className="size-3.5 shrink-0" /> {item.label}
                    </p>
                    <p className={`mt-1 line-clamp-2 text-sm font-bold ${item.tone}`} title={item.value}>
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>

            {actions.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {actions.map((action) => {
                  const Icon = actionIcons[action.kind];
                  const recommended = action.kind === recommendedAction?.kind;
                  return (
                    <Link
                      key={action.kind}
                      href={action.href}
                      prefetch={false}
                      className={`btn btn-block-mobile min-h-11 sm:w-auto ${
                        recommended
                          ? "btn-primary"
                          : action.kind === "ARCHIVE"
                            ? "btn-ghost border-[var(--danger)]/30 text-[var(--danger)]"
                            : "btn-ghost"
                      }`}
                    >
                      <Icon className="size-4" /> {action.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm xl:block">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Dossier</p>
          <p className="mt-1 font-bold text-[var(--foreground)]">
            {activeSubscriptionsCount} abo · {activityScopeLabel}
          </p>
          <p className="mt-1 max-w-52 text-xs text-[var(--muted-foreground)]">
            {recommendedAction
              ? `Action recommandée : ${recommendedAction.label.toLowerCase()}`
              : "Aucune action urgente"}
          </p>
        </div>
      </div>
    </section>
  );
}
