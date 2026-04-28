import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default async function PaymentsPage() {
  let hasError = false;
  let payments: Array<{
    id: string;
    memberName: string;
    planName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string | null;
    notes: string | null;
  }> = [];

  try {
    const rows = await prisma.payment.findMany({
      orderBy: { paymentDate: "desc" },
      take: 200,
      include: {
        memberSubscription: {
          select: {
            member: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        },
      },
    });

    payments = rows.map((p) => ({
      id: p.id,
      memberName: p.memberSubscription.member
        ? `${p.memberSubscription.member.firstName} ${p.memberSubscription.member.lastName}`
        : "—",
      planName: p.memberSubscription.plan?.name ?? "—",
      amount: p.amount,
      paymentDate: p.paymentDate.toISOString(),
      paymentMethod: p.paymentMethod,
      notes: p.notes,
    }));
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

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Abonnements & Finance"
        title="Paiements"
        description={`${payments.length} paiement(s) enregistré(s) — total ${formatCurrency(totalPayments)}.`}
      />

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
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{p.memberName}</td>
                  <td className="px-4 py-3">{p.planName}</td>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{new Date(p.paymentDate).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{p.paymentMethod ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[var(--muted-foreground)]">{p.notes ?? "—"}</td>
                </tr>
              ))}
              {payments.length === 0 && (
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
