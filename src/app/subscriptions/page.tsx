import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SubscriptionStatus } from "@prisma/client";

function statusVariant(status: SubscriptionStatus) {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "info";
    case "EXPIRED":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "muted";
  }
}

function statusLabel(status: SubscriptionStatus) {
  switch (status) {
    case "ACTIVE":
      return "Actif";
    case "DRAFT":
      return "Brouillon";
    case "EXPIRED":
      return "Expiré";
    case "CANCELLED":
      return "Annulé";
    default:
      return status;
  }
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}

export default async function SubscriptionsPage() {
  let hasError = false;
  let subscriptions: Array<{
    id: string;
    memberName: string;
    memberPhone: string;
    planName: string;
    amount: number;
    startDate: string;
    endDate: string | null;
    status: SubscriptionStatus;
    totalPaid: number;
    remainingSessions: number;
    totalSessions: number;
    createdAt: string;
  }> = [];

  try {
    const rows = await prisma.memberSubscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        member: { select: { firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true, totalSessions: true } },
        payments: { select: { amount: true } },
      },
    });

    subscriptions = rows.map((s) => ({
      id: s.id,
      memberName: `${s.member.firstName} ${s.member.lastName}`,
      memberPhone: s.member.phone,
      planName: s.plan.name,
      amount: s.amount,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString() ?? null,
      status: s.status,
      totalPaid: s.payments.reduce((sum, p) => sum + p.amount, 0),
      remainingSessions: s.remainingSessions,
      totalSessions: s.plan.totalSessions,
      createdAt: s.createdAt.toISOString(),
    }));
  } catch (error) {
    hasError = true;
    console.error("Subscriptions page degraded mode:", error);
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Abonnements indisponibles</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/" className="btn btn-ghost">Retour au dashboard</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Abonnements & Finance"
        title="Abonnements"
        description="Suivi des abonnements membres, statuts et paiements associés."
        actions={
          <Link href="/subscriptions/new" className="btn btn-primary inline-flex items-center gap-1.5 text-sm">
            <Plus className="size-4" /> Nouvel abonnement
          </Link>
        }
      />

      <section className="panel p-5">
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Membre</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Montant</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Début</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Fin</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Payé</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
                <th className="px-4 py-3 text-center font-semibold hidden sm:table-cell">Séances</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {sub.memberName}
                    <p className="text-xs text-[var(--muted-foreground)]">{sub.memberPhone}</p>
                  </td>
                  <td className="px-4 py-3">{sub.planName}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{formatCurrency(sub.amount)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{formatDate(new Date(sub.startDate))}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{formatDate(sub.endDate ? new Date(sub.endDate) : null)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={sub.totalPaid >= sub.amount ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                      {formatCurrency(sub.totalPaid)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={statusVariant(sub.status)}>{statusLabel(sub.status)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-center">
                    <span className={sub.remainingSessions > 0 ? "text-[var(--info)]" : "text-[var(--danger)]"}>
                      {sub.remainingSessions} / {sub.totalSessions}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[var(--muted-foreground)]">
                    {new Date(sub.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-5 text-center text-[var(--muted-foreground)]">
                    Aucun abonnement enregistré.
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
