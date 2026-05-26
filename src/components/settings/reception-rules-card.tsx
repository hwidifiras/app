import { ReceptionInfoCard } from "@/components/ui/reception-info-card";

const RULES = [
  "Une formule = un prix + un quota de séances + une durée.",
  "Payer plus ne ajoute pas de séances — choisissez la bonne formule ou renouvelez.",
  "Le pointage consomme des séances (présence et absence selon réglage club).",
  "Passage exceptionnel = motif obligatoire, max 3 sur 30 jours.",
  "Renouveler = nouvelle période — les séances non utilisées ne sont pas reportées sauf option explicite.",
];

export function ReceptionRulesCard() {
  return (
    <ReceptionInfoCard title="Règles réception" variant="info">
      <ul className="list-inside list-disc space-y-1.5 text-xs sm:text-sm">
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </ReceptionInfoCard>
  );
}
