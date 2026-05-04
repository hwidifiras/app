import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserCreateForm } from "@/components/settings/user-create-form";

export default async function SettingsUsersPage() {
  const h = await headers();
  const role = h.get("x-user-role");

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
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    take: 200,
  });

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Paramètres"
        title="Utilisateurs"
        description="Créez les comptes du staff (ex: 2 comptes pour le client)."
      />

      <section className="panel panel-soft p-5 md:p-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Créer un utilisateur</h2>
        <div className="mt-4">
          <UserCreateForm />
        </div>
      </section>

      <section className="panel mt-6 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Liste ({users.length})</h2>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nom</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Rôle</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{u.name}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{u.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={u.role === "ADMIN" ? "info" : "muted"}>
                      {u.role === "ADMIN" ? "Admin" : "Staff"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <StatusBadge variant={u.isActive ? "success" : "warning"}>
                      {u.isActive ? "Actif" : "Désactivé"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-[var(--muted-foreground)]">
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
