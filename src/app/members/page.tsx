import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MemberListClient } from "@/components/members/member-list-client";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MembersPage() {
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Élèves"
          title="Membres"
          description="Connectez-vous pour consulter les dossiers membres."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  let hasMemberDataError = false;
  let initialMembers: Array<{
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
  }> = [];

  let groupsOptions: Array<{ id: string; name: string; sportId: string }> = [];
  let sportsOptions: Array<{ id: string; name: string }> = [];

  try {
    const [members, groups, sports] = await Promise.all([
      prisma.member.findMany({
        where: { tenantId: authUser.tenantId },
        orderBy: { createdAt: "desc" },
        include: {
          groups: {
            where: { tenantId: authUser.tenantId, status: "ACTIVE" },
            select: { groupId: true },
          },
          subscriptions: {
            where: { tenantId: authUser.tenantId, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              amount: true,
              payments: { where: { tenantId: authUser.tenantId }, select: { amount: true } },
            },
          },
        },
      }),
      prisma.group.findMany({
        where: { tenantId: authUser.tenantId, isActive: true },
        select: { id: true, name: true, sportId: true },
        orderBy: { name: "asc" },
      }),
      prisma.sport.findMany({
        where: { tenantId: authUser.tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    initialMembers = members.map((member) => {
      const subscription = member.subscriptions[0];
      const totalPaid = subscription
        ? subscription.payments.reduce((sum, p) => sum + p.amount, 0)
        : 0;
      const paymentStatus = subscription
        ? totalPaid >= subscription.amount
          ? "PAID"
          : totalPaid > 0
            ? "PARTIAL"
            : "UNPAID"
        : "UNPAID";

      return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      email: member.email,
      memberType: member.memberType,
      gender: member.gender,
      birthDate: member.birthDate?.toISOString() ?? null,
      address: member.address ?? null,
      parentName: member.parentName ?? null,
      parentPhone: member.parentPhone ?? null,
      parentAddress: member.parentAddress ?? null,
      status: member.status,
      paymentStatus,
      joinedAt: member.joinedAt.toISOString(),
      archivedAt: member.archivedAt?.toISOString() ?? null,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      groupIds: (member.groups as unknown as Array<{ groupId: string }>).map((g) => g.groupId),
      };
    });

    groupsOptions = groups.map((g) => ({ id: g.id, name: g.name, sportId: g.sportId }));
    sportsOptions = sports.map((s) => ({ id: s.id, name: s.name }));
  } catch (error) {
    hasMemberDataError = true;
    console.error("Members page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasMemberDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Gestion des membres indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Cette page ne peut pas charger ses données pour le moment. Revenez au tableau de bord puis contactez le
            support si le problème continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="btn btn-ghost">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Élèves"
        title="Membres"
        description="Rechercher, filtrer et ouvrir les dossiers utiles à l'accueil."
      />

      <section className="panel p-3 sm:p-5">
        <MemberListClient
          initialMembers={initialMembers}
          groupsOptions={groupsOptions}
          sportsOptions={sportsOptions}
        />
      </section>
    </main>
  );
}
