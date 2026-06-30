import { headers } from "next/headers";
import Link from "next/link";
import { Plus } from "lucide-react";

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
        overline="Administration"
        title="Utilisateurs"
        description="Créer, activer et réinitialiser les comptes du staff."
        actions={
          <Link href="#user-create" className="btn btn-primary btn-block-mobile">
            <Plus className="size-4" /> Ajouter un utilisateur
          </Link>
        }
      />

      <div className="grid gap-4 md:gap-6">
        <section className="panel order-1 p-4 md:order-2 md:p-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Liste ({users.length})</h2>
          <div className="mt-4">
            <UsersListClient users={rows} currentUserId={currentUserId} />
          </div>
        </section>

        <section id="user-create" className="panel panel-soft order-2 scroll-mt-24 p-4 md:order-1 md:p-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Créer un utilisateur</h2>
          <div className="mt-4">
            <UserCreateForm />
          </div>
        </section>
      </div>
    </main>
  );
}
