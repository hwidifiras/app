import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type PaymentRow = {
  id: string;
  subscriptionId: string;
  totalDue: number;
  memberName: string;
  planName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
};

type PaymentGroup = {
  subscriptionId: string;
  memberName: string;
  planName: string;
  totalDue: number;
  totalPaid: number;
  isComplete: boolean;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string | null;
    status: string;
  }>;
};

export default async function PaymentsPage() {
  let hasError = false;
  let paymentGroups: PaymentGroup[] = [];

  try {
    const rows = await prisma.payment.findMany({
      orderBy: { paymentDate: "desc" },
      take: 200,
      include: {
        memberSubscription: {
          select: {
            id: true,
            amount: true,
            member: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        },
      },
    });

    const payments: PaymentRow[] = rows.map((p) => ({
      id: p.id,
      subscriptionId: p.memberSubscription.id,
      totalDue: p.memberSubscription.amount,
      memberName: p.memberSubscription.member
        ? `${p.memberSubscription.member.firstName} ${p.memberSubscription.member.lastName}`
        : "—",
      planName: p.memberSubscription.plan?.name ?? "—",
      amount: p.amount,
      paymentDate: p.paymentDate.toISOString(),
      paymentMethod: p.paymentMethod,
    }));

    // Regrouper par abonnement
    const grouped = new Map<string, PaymentRow[]>();
    for (const p of payments) {
      if (!grouped.has(p.subscriptionId)) {
        grouped.set(p.subscriptionId, []);
      }
      grouped.get(p.subscriptionId)!.push(p);
    }

    paymentGroups = Array.from(grouped.entries()).map(([subscriptionId, items]) => {
      // Trier par date croissante pour calculer les cumuls dans l'ordre chronologique
      const sorted = [...items].sort(
        (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
      );

      const totalDue = sorted[0].totalDue;
      const totalPaid = sorted.reduce((sum, p) => sum + p.amount, 0);
      const isComplete = totalPaid >= totalDue;

      let cumul = 0;
      const paymentsWithStatus = sorted.map((p, index) => {
        cumul += p.amount;
        const remainingAfter = Math.max(0, totalDue - cumul);
        const isLast = index === sorted.length - 1;
        const isFirst = index === 0;
        const isSingle = sorted.length === 1;

        let status: string;
        if (isSingle && remainingAfter === 0) {
          status = "Paiement complet";
        } else if (isFirst) {
          status = `Avance — reste : ${formatCurrency(remainingAfter)}`;
        } else if (isLast && remainingAfter === 0) {
          status = "Paiement complet";
        } else {
          status = `Versement — reste : ${formatCurrency(remainingAfter)}`;
        }

        return {
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          status,
        };
      });

      // Ré-afficher par date décroissante (plus récent en premier)
      paymentsWithStatus.reverse();

      return {
        subscriptionId,
        memberName: sorted[0].memberName,
        planName: sorted[0].planName,
        totalDue,
        totalPaid,
        isComplete,
        payments: paymentsWithStatus,
      };
    });
  } catch (error) {
    hasError = true;
    console.error("Payments page degraded mode:", error);
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Paiements indisponibles</h1>
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

  const totalPayments = paymentGroups.reduce((sum, g) => sum + g.totalPaid, 0);
  const totalCount = paymentGroups.reduce((sum, g) => sum + g.payments.length, 0);

  return (
    <main className="app-shell py-4 md:py-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          overline="Abonnements & Finance"
          title="Paiements"
          description={`${totalCount} versement(s) enregistré(s) — total ${formatCurrency(totalPayments)}.`}
        />
        <Link
          href="/payments/new"
          className="btn btn-primary shrink-0"
        >
          + Nouveau paiement
        </Link>
      </div>

      <section className="panel p-5">
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Membre</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Montant</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Méthode</th>
                <th className="px-4 py-3 text-left font-semibold">Statut versement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {paymentGroups.map((group) => (
                <Fragment key={group.subscriptionId}>
                  {/* Ligne parente : récapitulatif de l'abonnement */}
                  <tr key={group.subscriptionId} className="bg-[var(--surface-soft)]">
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{group.memberName}</td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{group.planName}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                      {formatCurrency(group.totalPaid)}
                      <span className="text-[var(--muted-foreground)] font-normal"> / {formatCurrency(group.totalDue)}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">—</td>
                    <td className="px-4 py-3 hidden md:table-cell">—</td>
                    <td className="px-4 py-3">
                      {group.isComplete ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Payé
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Partiel — reste {formatCurrency(group.totalDue - group.totalPaid)}
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Sous-lignes : chaque versement */}
                  {group.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                      <td className="px-4 py-2 pl-8 text-[var(--muted-foreground)]">—</td>
                      <td className="px-4 py-2 pl-8">
                        <span className="sm:hidden text-xs text-[var(--muted-foreground)]">
                          {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                          {p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                        </span>
                        <span className="hidden sm:inline text-[var(--muted-foreground)]">—</span>
                      </td>
                      <td className="px-4 py-2 pl-8 font-medium text-[var(--foreground)]">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-2 pl-8 hidden sm:table-cell">
                        {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-2 pl-8 hidden md:table-cell">{p.paymentMethod ?? "—"}</td>
                      <td className="px-4 py-2 pl-8">
                        {p.status === "Paiement complet" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {p.status}
                          </span>
                        ) : p.status.startsWith("Avance") ? (
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                            {p.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              {paymentGroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-[var(--muted-foreground)]">
                    Aucun paiement enregistré.
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
