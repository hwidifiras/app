import { Building2, ClipboardList, Dumbbell, ShieldCheck } from "lucide-react";

const roleGuides = [
  {
    title: "Admin",
    intent: "Pour propriétaire ou responsable club",
    description: "Configuration, utilisateurs, journal d'actions, formules, offres et règles sensibles.",
    icon: ShieldCheck,
    tone: "blue",
  },
  {
    title: "Responsable",
    intent: "Pour manager opérationnel",
    description: "Pilote les ventes, cours, salle et réglages sans gérer les administrateurs.",
    icon: Building2,
    tone: "blue",
  },
  {
    title: "Réception",
    intent: "Pour accueil et caisse",
    description: "Inscrire, encaisser, gérer élèves, relancer paiements et pointer au quotidien.",
    icon: ClipboardList,
    tone: "green",
  },
  {
    title: "Coach",
    intent: "Pour terrain et présence",
    description: "Pointer les cours autorisés et suivre les groupes sans accès aux réglages sensibles.",
    icon: Dumbbell,
    tone: "slate",
  },
];

const toneClasses = {
  blue: "border-[var(--primary)]/20 bg-[var(--primary)]/5 text-[var(--primary)]",
  green: "border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]",
  slate: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
};

export function UserRoleGuide() {
  return (
    <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {roleGuides.map((guide) => {
        const Icon = guide.icon;
        return (
          <article key={guide.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-start gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${toneClasses[guide.tone as keyof typeof toneClasses]}`}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--foreground)]">{guide.title}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--primary)]">{guide.intent}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {guide.description}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
