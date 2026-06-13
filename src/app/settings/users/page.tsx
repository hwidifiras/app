import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { UserCreateForm } from "@/components/settings/user-create-form";
import { UsersListClient } from "@/components/settings/users-list-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsUsersPage() {
  const h = await headers();
  const role = h.get("x-user-role");
  const currentUserId = h.get("x-user-id") ?? "";

  if (role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Paramètres"
          title="Utilisateurs"
          description="Seul un ADMIN peut gérer les comptes."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const users = await prisma.user.findMany({
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

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Paramètres"
        title="Utilisateurs"
        description="Créez et gérez les comptes du staff : nom, email, activation et réinitialisation du mot de passe."
      />

      <section className="panel panel-soft p-5 md:p-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Créer un utilisateur</h2>
        <div className="mt-4">
          <UserCreateForm />
        </div>
      </section>

      <section className="panel mt-6 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Liste ({users.length})</h2>
        <div className="mt-4">
          <UsersListClient users={rows} currentUserId={currentUserId} />
        </div>
      </section>
    </main>
  );
}
