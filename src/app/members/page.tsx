import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MemberListClient } from "@/components/members/member-list-client";
import { PageHeader } from "@/components/ui/page-header";
import { getMemberDirectoryPage, type MemberDirectoryPage } from "@/lib/member-directory";
import { hasPermission } from "@/lib/permission-definitions";
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

  const canSellEnrollment =
    authUser.role === "ADMIN" || hasPermission(authUser.permissions, "enrollment.sell");

  let hasMemberDataError = false;
  let initialPage: MemberDirectoryPage = {
    data: [],
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  };

  let groupsOptions: Array<{ id: string; name: string; sportId: string }> = [];
  let sportsOptions: Array<{ id: string; name: string }> = [];

  try {
    const [directoryPage, groups, sports] = await Promise.all([
      getMemberDirectoryPage({ tenantId: authUser.tenantId }),
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

    initialPage = directoryPage;
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
          initialPage={initialPage}
          groupsOptions={groupsOptions}
          sportsOptions={sportsOptions}
          canSellEnrollment={canSellEnrollment}
        />
      </section>
    </main>
  );
}
