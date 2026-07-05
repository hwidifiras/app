import Link from "next/link";
import type { ComponentType } from "react";
import { Banknote, CalendarCheck2, CreditCard, PencilLine, ShieldCheck, UsersRound } from "lucide-react";

type MemberRecoveryGuideProps = {
  memberId: string;
  hasSubscriptions: boolean;
  hasAttendances: boolean;
};

type RecoveryItem = {
  label: string;
  description: string;
  href: string;
  action: string;
  icon: ComponentType<{ className?: string }>;
};

export function MemberRecoveryGuide({
  memberId,
  hasSubscriptions,
  hasAttendances,
}: MemberRecoveryGuideProps) {
  const items: RecoveryItem[] = [
    {
      label: "Identité",
      description: "Corriger téléphone, parent, genre ou adresse sans toucher l'historique.",
      href: "#member-edit",
      action: "Modifier",
      icon: PencilLine,
    },
    {
      label: "Abonnement",
      description: hasSubscriptions
        ? "Corriger dates, formule ou statut avec motif si la règle le permet."
        : "Créer une formule avant de pouvoir corriger une période.",
      href: hasSubscriptions ? "#member-subscriptions" : `/subscriptions/new?memberId=${memberId}`,
      action: hasSubscriptions ? "Voir" : "Renouveler",
      icon: CreditCard,
    },
    {
      label: "Paiement",
      description: "Corriger ou annuler un encaissement avec motif. Le paiement original reste conservé.",
      href: "/payments",
      action: "Historique",
      icon: Banknote,
    },
    {
      label: "Pointage",
      description: hasAttendances
        ? "Rouvrir ou corriger depuis la séance concernée pour garder la trace."
        : "Les corrections seront disponibles après le premier pointage.",
      href: hasAttendances ? "#member-attendance" : "/attendance/today",
      action: hasAttendances ? "Voir" : "Pointage",
      icon: CalendarCheck2,
    },
    {
      label: "Affectation",
      description: "Ajouter ce membre au bon cours ou corriger son groupe actif.",
      href: `/members/${memberId}/add-to-group`,
      action: "Affecter",
      icon: UsersRound,
    },
  ];

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2 text-[var(--primary)]">
          <ShieldCheck className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Corriger une erreur</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Les erreurs se corrigent par élément: identité, abonnement, paiement, pointage ou affectation. Les actions
            sensibles gardent un motif dans le journal.
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={false}
              className="group flex items-start gap-3 px-3 py-3 transition hover:bg-[var(--surface-soft)]"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{item.label}</span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--primary)]">{item.action}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
