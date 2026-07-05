import Link from "next/link";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsMetric } from "@/components/settings/settings-hub";
import { UserCreateForm } from "@/components/settings/user-create-form";
import { UserRoleGuide } from "@/components/settings/user-role-guide";
import { UsersListClient } from "@/components/settings/users-list-client";
import { deriveUserRoleIntent } from "@/lib/user-role-intent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsUsersPage() {
  const authUser = await getAuthUser();

  if (!authUser || authUser.role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Administration"
          title="Utilisateurs"
          description="Seul un administrateur peut gérer les comptes."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const users = await prisma.user.findMany({
    where: { tenantId: authUser.tenantId },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      permissions: { select: { key: true } },
    },
  });

  const rows = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));
  const roleCounts = rows.reduce(
    (acc, user) => {
      const intent = deriveUserRoleIntent(user.role, user.permissions.map((permission) => permission.key));
      if (intent === "ADMIN") acc.admin += 1;
      if (intent === "RECEPTION") acc.reception += 1;
      if (intent === "COACH") acc.coach += 1;
      if (!user.isActive) acc.inactive += 1;
      return acc;
    },
    { admin: 0, reception: 0, coach: 0, inactive: 0 },
  );

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Administration"
        title="Utilisateurs"
        description="Créer les accès Admin, Réception et Coach, puis limiter chaque compte aux écrans utiles."
        actions={
          <Link href="#user-create" className="btn btn-primary btn-block-mobile">
            <Plus className="size-4" /> Ajouter un utilisateur
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Admin" value={roleCounts.admin} detail="Configuration et journal" />
        <SettingsMetric label="Réception" value={roleCounts.reception} detail="Vente, caisse et élèves" />
        <SettingsMetric label="Coach" value={roleCounts.coach} detail="Pointage et suivi cours" />
        <SettingsMetric label="Désactivés" value={roleCounts.inactive} detail="Accès coupés immédiatement" />
      </section>

      <UserRoleGuide />

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <section className="panel order-2 p-4 xl:order-1 md:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
                Accès existants
              </p>
              <h2 className="text-base font-black text-[var(--foreground)]">Comptes du club ({users.length})</h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Désactiver un compte coupe l&apos;accès sans supprimer son historique.
            </p>
          </div>
          <div className="mt-4">
            <UsersListClient users={rows} currentUserId={authUser.id} />
          </div>
        </section>

        <section id="user-create" className="panel order-1 scroll-mt-24 p-4 xl:order-2 md:p-6">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            Nouvel accès
          </p>
          <h2 className="mt-1 text-base font-black text-[var(--foreground)]">Créer un utilisateur</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Choisissez un profil simple, puis ajustez les droits si nécessaire. Les actions sensibles restent
            tracées dans le journal.
          </p>
          <div className="mt-4">
            <UserCreateForm />
          </div>
        </section>
      </div>
    </main>
  );
}
