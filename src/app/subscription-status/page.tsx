import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/request-user";
import { getTenantProductContext } from "@/platform/product/product-context";

function formatDate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-TN", { day: "2-digit", month: "long", year: "numeric" }).format(value);
}

const statusLabels = {
  SUSPENDED: "Abonnement suspendu",
  CANCELLED: "Abonnement résilié",
} as const;

export default async function SubscriptionStatusPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const product = await getTenantProductContext(user.tenantId);
  if (product.operationsAllowed) redirect("/");

  const status = product.saasStatus === "CANCELLED" ? "CANCELLED" : "SUSPENDED";
  const periodEnd = formatDate(product.saasSubscription?.currentPeriodEnd);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase text-[var(--primary)]">Accès au club</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">{statusLabels[status]}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Les données de {product.tenantName} sont conservées, mais les opérations sont temporairement bloquées.
          {periodEnd ? ` La dernière période s'est terminée le ${periodEnd}.` : ""}
        </p>
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--foreground)]">
          {user.role === "ADMIN"
            ? "Contactez We Discipline pour réactiver l'abonnement. Aucun membre, paiement ou historique n'a été supprimé."
            : "Contactez l'administrateur du club. Seul un administrateur peut demander la réactivation."}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings/account"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
          >
            Mon compte
          </Link>
        </div>
      </section>
    </div>
  );
}
