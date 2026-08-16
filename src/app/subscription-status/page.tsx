import Link from "next/link";
import { CircleCheck, Clock3, LockKeyhole, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/request-user";
import { getTenantProductContext } from "@/platform/product/product-context";

function formatDate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-TN", { day: "2-digit", month: "long", year: "numeric" }).format(value);
}

export default async function SubscriptionStatusPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const product = await getTenantProductContext(user.tenantId);
  const deadline = formatDate(product.subscriptionDeadlineAt);
  const planName = product.saasSubscription?.planName;
  const days = product.subscriptionDaysRemaining;
  const isBlocked = !product.operationsAllowed;
  const trialGrace = product.billingWarning === "TRIAL_GRACE";

  const presentation = isBlocked
    ? {
        overline: "Accès au club",
        title: product.subscriptionBlockReason === "TRIAL_EXPIRED"
          ? "Période d'essai terminée"
          : product.saasStatus === "CANCELLED"
            ? "Abonnement résilié"
            : "Abonnement suspendu",
        description: `Les données de ${product.tenantName} sont conservées, mais les opérations sont temporairement bloquées.${deadline ? ` La période d'accès s'est terminée le ${deadline}.` : ""}`,
        tone: "amber" as const,
        icon: LockKeyhole,
      }
    : product.saasStatus === "TRIAL"
      ? {
          overline: "Période d'essai",
          title: "Votre espace est actif",
          description: `Vous pouvez utiliser toutes les fonctions de votre formule${deadline ? ` jusqu'au ${deadline}` : ""}.${days !== null ? ` Il reste ${days} jour${days > 1 ? "s" : ""}.` : ""}`,
          tone: "blue" as const,
          icon: Clock3,
        }
      : trialGrace
        ? {
            overline: "Fin de l'essai",
            title: "Accès temporairement maintenu",
            description: `Votre essai est terminé, mais votre club reste utilisable${deadline ? ` jusqu'au ${deadline}` : " pendant une courte période"}. Contactez-nous pour conserver l'accès sans interruption.`,
            tone: "amber" as const,
            icon: TriangleAlert,
          }
        : product.billingWarning
          ? {
              overline: "Abonnement",
              title: "Règlement à régulariser",
              description: `Le club reste utilisable pour le moment${deadline ? ` jusqu'au ${deadline}` : ""}. Contactez-nous pour éviter une interruption.`,
              tone: "amber" as const,
              icon: TriangleAlert,
            }
          : {
              overline: "Abonnement",
              title: "Votre accès est actif",
              description: "Votre espace et vos données sont disponibles normalement.",
              tone: "green" as const,
              icon: CircleCheck,
            };

  const Icon = presentation.icon;
  const toneClasses = presentation.tone === "green"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    : presentation.tone === "blue"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <div className={`mb-5 flex size-11 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase text-[var(--primary)]">{presentation.overline}</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">{presentation.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{presentation.description}</p>

        {planName ? (
          <dl className="mt-6 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">Formule</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">{planName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                {isBlocked
                  ? "Accès terminé le"
                  : product.saasStatus === "TRIAL"
                    ? "Fin de l'essai"
                    : "Prochaine échéance"}
              </dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">{deadline ?? "À confirmer"}</dd>
            </div>
          </dl>
        ) : null}

        {isBlocked ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100">
            {user.role === "ADMIN"
              ? "Aucun membre, paiement, reçu ou historique n'a été supprimé. Réactivez l'abonnement pour reprendre les opérations."
              : "Contactez l'administrateur du club. Seul un administrateur peut demander la réactivation."}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {product.operationsAllowed ? (
            <Link href="/" className="btn btn-primary min-h-11 justify-center">
              Retour au dashboard
            </Link>
          ) : null}
          {user.role === "ADMIN" && (isBlocked || product.billingWarning) ? (
            <a href="mailto:contact@wediscipline.com" className="btn btn-ghost min-h-11 justify-center">
              Contacter We Discipline
            </a>
          ) : null}
          <Link href="/settings/account" className="btn btn-ghost min-h-11 justify-center">
            Mon compte
          </Link>
        </div>
      </section>
    </div>
  );
}
