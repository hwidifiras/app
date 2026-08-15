import { ReceptionInfoCard } from "@/components/ui/reception-info-card";

import type { ProductProfile } from "@/platform/product/product-context";

const CLASS_RULES = [
  "Une formule = un prix + un quota de séances + une durée.",
  "Payer plus ne ajoute pas de séances — choisissez la bonne formule ou renouvelez.",
  "Le pointage consomme des séances (présence et absence selon réglage club).",
  "Passage exceptionnel = motif obligatoire, max 3 sur 30 jours.",
  "Renouveler = nouvelle période — les séances non utilisées ne sont pas reportées sauf option explicite.",
];

const GYM_RULES = [
  "Un pass salle = un prix + une durée + un accès illimité ou un quota de visites.",
  "Chaque entrée est contrôlée selon la validité, le paiement et le quota restant.",
  "Un passage exceptionnel exige toujours un motif et reste visible dans le journal.",
  "Une erreur de pointage se corrige par annulation traçable, sans supprimer le passage original.",
];

export function ReceptionRulesCard({ profile = "CLASS_ONLY" }: { profile?: ProductProfile }) {
  const rules = profile === "GYM_ONLY"
    ? GYM_RULES
    : profile === "HYBRID"
      ? [...CLASS_RULES.slice(0, 3), ...GYM_RULES.slice(1, 4)]
      : CLASS_RULES;

  return (
    <ReceptionInfoCard title="Règles réception" variant="info">
      <ul className="list-inside list-disc space-y-1.5 text-xs sm:text-sm">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </ReceptionInfoCard>
  );
}
