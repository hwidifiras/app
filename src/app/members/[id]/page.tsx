import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, Clock3, CreditCard, UsersRound } from "lucide-react";

import { MemberDangerActions } from "@/components/members/member-danger-actions";
import { GymMemberCardManager } from "@/components/gym/gym-member-card-manager";
import { MemberEditCard } from "@/components/members/member-edit-card";
import { MemberOffersSection } from "@/components/members/member-offers-section";
import {
  MemberProfileHero,
  type MemberProfileAction,
} from "@/components/members/member-profile-hero";
import { MemberRecoveryGuide } from "@/components/members/member-recovery-guide";
import { MemberSubscriptionCards } from "@/components/members/member-subscription-cards";
import { HouseholdCard } from "@/components/members/household-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  Td,
  Th,
} from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRoomLabel } from "@/lib/group-room";
import { getEnrollmentRecoveryCandidatesForMember } from "@/lib/enrollment-recovery";
import { paymentNewHref } from "@/lib/payment-navigation";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { getAuthUser } from "@/lib/request-user";
import { isTechnicalAdmin } from "@/lib/technical-admin";
import { buildMemberProductHealth } from "@/modules/members/member-product-health";
import { getTenantProductContext } from "@/platform/product/product-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-FR");
}

function attendanceStatus(status: string) {
  if (status === "PRESENT") return { label: "Présent", variant: "success" as const };
  if (status === "ABSENT") return { label: "Absent", variant: "danger" as const };
  return { label: "Exception", variant: "warning" as const };
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <section className="panel panel-soft p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">Fiche membre indisponible</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Connectez-vous pour consulter ce dossier.</p>
        </section>
      </main>
    );
  }

  const [
    product,
    canManageGymCards,
    canCollectPayments,
    canSellEnrollment,
    canCheckInGym,
    canCorrectSubscriptions,
  ] = await Promise.all([
    getTenantProductContext(authUser.tenantId),
    userHasPermission(authUser, "gym.manage"),
    userHasPermission(authUser, "payments.collect"),
    userHasPermission(authUser, "enrollment.sell"),
    userHasPermission(authUser, "gym.checkin"),
    userHasPermission(authUser, "subscriptions.correct"),
  ]);

  const member = await prisma.member.findFirst({
    where: { id, tenantId: authUser.tenantId },
    include: {
      subscriptions: {
        where: { tenantId: authUser.tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          sport: { select: { id: true, name: true } },
          plan: { select: { name: true, price: true, totalSessions: true, planKind: true } },
          entitlements: { include: { sport: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
          pauseEvents: {
            select: {
              id: true,
              entryType: true,
              pauseEventId: true,
              effectiveAt: true,
              durationSeconds: true,
            },
            orderBy: { effectiveAt: "asc" },
          },
          renewedBySubscription: {
            select: {
              status: true,
              activationPolicy: true,
              activatedAt: true,
              startDate: true,
            },
          },
          payments: {
            where: { tenantId: authUser.tenantId },
            select: { amount: true, paymentDate: true },
            orderBy: { paymentDate: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!member) {
    notFound();
  }

  const [
    memberGroups,
    memberAttendances,
    accessCredentials,
    latestGymVisit,
    enrollmentRecoveryCandidates,
  ] = await Promise.all([
    product.capabilities.classManagement
      ? prisma.groupMember.findMany({
          where: { tenantId: authUser.tenantId, memberId: member.id },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                sport: { select: { name: true } },
                coach: { select: { firstName: true, lastName: true } },
                room: true,
                schedules: {
                  where: { tenantId: authUser.tenantId },
                  orderBy: { createdAt: "asc" },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    product.capabilities.classManagement
      ? prisma.attendance.findMany({
          where: { tenantId: authUser.tenantId, memberId: member.id },
          orderBy: { checkedAt: "desc" },
          take: 20,
          include: {
            session: {
              select: {
                id: true,
                sessionDate: true,
                startTime: true,
                group: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    product.capabilities.gymAccess && canManageGymCards
      ? prisma.memberAccessCredential.findMany({
          where: { tenantId: authUser.tenantId, memberId: member.id, revokedAt: null },
          select: { id: true, codeHint: true, issuedAt: true },
          orderBy: { issuedAt: "desc" },
          take: 1,
        })
      : Promise.resolve([]),
    product.capabilities.gymAccess
      ? prisma.gymVisit.findFirst({
          where: {
            tenantId: authUser.tenantId,
            memberId: member.id,
            entryType: "CHECK_IN",
            corrections: { none: { entryType: "REVERSAL" } },
          },
          select: { checkedAt: true },
          orderBy: { checkedAt: "desc" },
        })
      : Promise.resolve(null),
    getEnrollmentRecoveryCandidatesForMember(member.id, authUser.tenantId),
  ]);

  const activeGroups = memberGroups.filter((assignment) => assignment.status === "ACTIVE");
  const inactiveGroups = memberGroups.filter((assignment) => assignment.status === "INACTIVE");
  const health = buildMemberProductHealth({
    memberStatus: member.status,
    subscriptions: member.subscriptions,
    activeGroupsCount: activeGroups.length,
    hasClassModule: product.capabilities.classManagement,
    hasGymModule: product.capabilities.gymAccess,
    lastClassAttendanceAt: memberAttendances[0]?.checkedAt ?? null,
    lastGymVisitAt: latestGymVisit?.checkedAt ?? null,
  });

  const enrollmentType = health.nextActionPlanKind === "GYM"
    ? "gym"
    : health.nextActionPlanKind === "MIXED"
      ? "mixed"
      : product.profile === "GYM_ONLY"
        ? "gym"
        : "class";
  const memberActions: MemberProfileAction[] = [];
  if (member.status === "ACTIVE" && health.debtCents > 0 && canCollectPayments) {
    memberActions.push({
      kind: "COLLECT",
      label: "Encaisser",
      href: paymentNewHref({ memberId: member.id, returnTo: `/members/${member.id}` }),
    });
  }
  if (
    member.status === "ACTIVE"
    && health.nextActionKind === "RESUME"
    && health.nextActionSubscriptionId
    && canCorrectSubscriptions
  ) {
    memberActions.push({
      kind: "RESUME",
      label: "Reprendre",
      href: `/subscriptions/${health.nextActionSubscriptionId}/edit`,
    });
  }
  if (member.status === "ACTIVE" && canSellEnrollment) {
    memberActions.push({
      kind: "RENEW",
      label: "Renouveler",
      href: `/enrollment?memberId=${member.id}&type=${enrollmentType}`,
    });
  }
  if (member.status === "ACTIVE" && product.capabilities.classManagement && canSellEnrollment) {
    memberActions.push({
      kind: "ASSIGN_CLASS",
      label: "Affecter",
      href: `/members/${member.id}/add-to-group`,
    });
  }
  if (member.status === "ACTIVE" && product.capabilities.gymAccess && canCheckInGym) {
    memberActions.push({
      kind: "GYM_CHECK_IN",
      label: "Accès salle",
      href: `/gym/check-in?query=${encodeURIComponent(member.phone)}`,
    });
  }
  if (member.status === "ACTIVE") {
    memberActions.push({ kind: "ARCHIVE", label: "Archiver", href: "#member-danger" });
  }
  const recommendedActionKind = memberActions.find((action) => action.kind === health.nextActionKind)?.kind ?? null;
  const nextReflex = {
    COLLECT: "Encaissez le solde avant le prochain accès, sauf passage exceptionnel autorisé.",
    RESUME: "Reprenez la formule quand le membre revient afin de réactiver tous ses droits.",
    GYM_CHECK_IN: "Le premier passage en salle activera cette formule automatiquement.",
    ASSIGN_CLASS: "Affectez le membre au bon cours avant son prochain pointage.",
    RENEW: "Préparez le renouvellement pour éviter une interruption d'accès.",
    NONE: "Le dossier est à jour. Aucune action urgente n'est nécessaire.",
  }[health.nextActionKind];
  const subscriptionCards = member.subscriptions.map((subscription) => ({
    id: subscription.id,
    planName: subscription.plan.name,
    sportName: subscription.sport?.name ?? "Acces salle",
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    amount: subscription.amount,
    paidCents: subscription.payments.reduce((sum, payment) => sum + payment.amount, 0),
    remainingSessions: subscription.remainingSessions,
    totalSessions: subscription.plan.totalSessions,
    rightsLabel: subscription.entitlements.map((right) => right.type === "GYM_ACCESS"
      ? right.gymAccessMode === "UNLIMITED" ? "Salle illimitée" : `Salle ${right.remainingUnits ?? 0}/${right.grantedUnits ?? 0}`
      : `${right.sport?.name ?? "Cours"} ${right.remainingUnits ?? 0}/${right.grantedUnits ?? 0}`
    ).join(" · ") || `${subscription.remainingSessions}/${subscription.plan.totalSessions} séances`,
  }));

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/members"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--surface-soft)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour aux membres
      </Link>

      <div className="grid min-w-0 gap-4 sm:gap-5">
        <MemberProfileHero
          member={{
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
            email: member.email,
            memberType: member.memberType,
            gender: member.gender,
            status: member.status,
            joinedAt: member.joinedAt,
            parentName: member.parentName,
            parentPhone: member.parentPhone,
          }}
          totalDebtCents={health.debtCents}
          activeSubscriptionsCount={health.currentSubscriptionCount}
          activityScopeLabel={product.profile === "GYM_ONLY"
            ? "accès salle"
            : product.profile === "HYBRID"
              ? `${activeGroups.length} cours · salle`
              : `${activeGroups.length} cours`}
          subscriptionLabel={health.subscriptionLabel}
          classRightsLabel={health.classRightsLabel}
          gymAccessLabel={health.gymAccessLabel}
          validityLabel={health.validityLabel}
          lastActivityLabel={health.lastActivityLabel}
          actions={memberActions}
          recommendedActionKind={recommendedActionKind}
        />

        <div className="grid min-w-0 items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 gap-4 sm:gap-5">
            {product.capabilities.classManagement ? (
            <section id="member-classes" className="panel min-w-0 scroll-mt-24 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                    Cours
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Actifs ({activeGroups.length})
                  </h2>
                </div>
                {member.status === "ACTIVE" ? (
                  <Link
                    href={`/members/${member.id}/add-to-group`}
                    prefetch={false}
                    className="btn btn-primary btn-block-mobile min-h-11 sm:w-auto"
                  >
                    + Affecter
                  </Link>
                ) : null}
              </div>

              {activeGroups.length === 0 ? (
                <EmptyState
                  icon={<UsersRound className="size-8 opacity-45" />}
                  title="Aucun cours actif"
                  message="Affectez ce membre à un cours pour le retrouver dans le pointage."
                  action={
                    member.status === "ACTIVE" ? (
                      <Link href={`/members/${member.id}/add-to-group`} prefetch={false} className="btn btn-primary min-h-11">
                        Affecter
                      </Link>
                    ) : undefined
                  }
                  className="py-8"
                />
              ) : (
                <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
                  {activeGroups.map((assignment) => {
                    const schedule = assignment.group.schedules[0];
                    const coach = assignment.group.coach
                      ? `${assignment.group.coach.firstName} ${assignment.group.coach.lastName}`
                      : "Sans coach";

                    return (
                      <li key={assignment.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                              {assignment.group.name}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {assignment.group.sport?.name ?? "-"} · {coach}
                            </p>
                          </div>
                          <StatusBadge variant="success">Actif</StatusBadge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
                          <span>{formatRoomLabel(assignment.group.room, "Salle par séance")}</span>
                          <span>{schedule ? `${schedule.dayOfWeek} ${schedule.startTime}` : "Créneau à planifier"}</span>
                          <span className="sm:col-span-2">Depuis le {formatDate(assignment.startDate)}</span>
                        </div>
                        <div className="mt-3">
                          <Link
                            href={`/sessions?groupId=${assignment.group.id}`}
                            prefetch={false}
                            className="btn btn-ghost min-h-11 w-full"
                          >
                            Voir planning
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            ) : null}

            <section id="member-subscriptions" className="panel min-w-0 scroll-mt-24 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                    Abonnements
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Formules ({member.subscriptions.length})
                  </h2>
                </div>
                <CreditCard className="size-5 text-[var(--muted-foreground)]" />
              </div>
              <MemberSubscriptionCards subscriptions={subscriptionCards} returnTo={`/members/${member.id}`} />
            </section>

            {product.capabilities.classManagement ? (
            <section id="member-attendance" className="panel min-w-0 scroll-mt-24 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                    Présences
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Récentes ({memberAttendances.length})
                  </h2>
                </div>
                <CalendarCheck2 className="size-5 text-[var(--muted-foreground)]" />
              </div>

              {memberAttendances.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck2 className="size-8 opacity-45" />}
                  title="Aucun pointage"
                  message="Les présences et absences apparaîtront ici après le premier pointage."
                  className="py-8"
                />
              ) : (
                <DataTable>
                  <DataTableHead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Cours</Th>
                      <Th>Statut</Th>
                      <Th className="hidden sm:table-cell">Pointage</Th>
                      <Th>Action</Th>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {memberAttendances.map((attendance) => {
                      const status = attendanceStatus(attendance.status);
                      return (
                        <DataTableRow key={attendance.id}>
                          <Td label="Date" primary>
                            {formatDate(attendance.session.sessionDate)} {attendance.session.startTime}
                          </Td>
                          <Td label="Cours">{attendance.session.group?.name ?? "-"}</Td>
                          <Td label="Statut">
                            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                          </Td>
                          <Td label="Pointage" className="hidden text-xs text-[var(--muted-foreground)] sm:table-cell">
                            {formatDate(attendance.checkedAt)}
                          </Td>
                          <Td label="Action">
                            <Link
                              href={`/attendance/sessions/${attendance.session.id}`}
                              prefetch={false}
                              className="btn btn-ghost min-h-11 w-full sm:w-auto"
                            >
                              Ouvrir
                            </Link>
                          </Td>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              )}
            </section>
            ) : null}

            <MemberOffersSection memberId={member.id} memberName={`${member.firstName} ${member.lastName}`} wide />

            {product.capabilities.classManagement && inactiveGroups.length > 0 ? (
              <details className="panel min-w-0 p-4 sm:p-5">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[var(--foreground)]">
                  Anciennes affectations ({inactiveGroups.length})
                </summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {inactiveGroups.map((assignment) => (
                    <li key={assignment.id} className="rounded-lg border border-[var(--border)] p-3 opacity-75">
                      <p className="text-sm font-medium">{assignment.group.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {assignment.group.sport?.name ?? "-"} · {formatRoomLabel(assignment.group.room, "Salle par séance")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDate(assignment.startDate)}
                        {assignment.endDate ? ` → ${formatDate(assignment.endDate)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <aside className="grid min-w-0 gap-4 sm:gap-5">
            {product.capabilities.gymAccess && canManageGymCards ? (
              <GymMemberCardManager
                memberId={member.id}
                memberName={`${member.firstName} ${member.lastName}`}
                initialCredential={accessCredentials[0]
                  ? {
                      id: accessCredentials[0].id,
                      codeHint: accessCredentials[0].codeHint,
                      issuedAt: accessCredentials[0].issuedAt.toISOString(),
                    }
                  : null}
              />
            ) : null}
            <MemberRecoveryGuide
              memberId={member.id}
              hasSubscriptions={member.subscriptions.length > 0}
              hasAttendances={memberAttendances.length > 0}
              hasGymVisits={Boolean(latestGymVisit)}
              hasClassModule={product.capabilities.classManagement}
              hasGymModule={product.capabilities.gymAccess}
              enrollmentRecoveryCandidates={enrollmentRecoveryCandidates}
            />
            <div id="member-edit" className="scroll-mt-24">
              <MemberEditCard
                member={{
                  id: member.id,
                  firstName: member.firstName,
                  lastName: member.lastName,
                  phone: member.phone,
                  email: member.email,
                  memberType: member.memberType,
                  gender: member.gender,
                  birthDate: member.birthDate?.toISOString() ?? null,
                  address: member.address,
                  parentName: member.parentName,
                  parentPhone: member.parentPhone,
                  parentAddress: member.parentAddress,
                  status: member.status,
                  joinedAt: member.joinedAt.toISOString(),
                  archivedAt: member.archivedAt?.toISOString() ?? null,
                }}
              />
            </div>
            <HouseholdCard memberId={member.id} />
            <div className="panel panel-soft p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <Clock3 className="size-4 text-[var(--primary)]" />
                Prochain réflexe
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {nextReflex}
              </p>
            </div>
            <div id="member-danger" className="scroll-mt-24">
              <MemberDangerActions
                memberId={member.id}
                memberName={`${member.firstName} ${member.lastName}`}
                status={member.status}
                canPermanentDelete={authUser.role === "ADMIN"}
                canTechnicalPurge={isTechnicalAdmin(authUser)}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
