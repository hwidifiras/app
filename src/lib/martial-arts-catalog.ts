export type MartialArtsDisciplineSuggestion = {
  name: string;
  description: string;
  family: "striking" | "grappling" | "traditional" | "self-defense" | "weapons";
};

export const MARTIAL_ARTS_DISCIPLINE_FAMILY_LABELS: Record<
  MartialArtsDisciplineSuggestion["family"],
  string
> = {
  striking: "Pieds-poings",
  grappling: "Sol / projections",
  traditional: "Arts traditionnels",
  "self-defense": "Self défense",
  weapons: "Armes / formes",
};

export const MARTIAL_ARTS_DISCIPLINE_SUGGESTIONS: MartialArtsDisciplineSuggestion[] = [
  {
    name: "Kick boxing",
    description: "Cours debout avec pieds-poings, cardio et technique.",
    family: "striking",
  },
  {
    name: "Boxe",
    description: "Cours de boxe anglaise, technique, sparring et condition physique.",
    family: "striking",
  },
  {
    name: "Muay Thai",
    description: "Cours pieds-poings avec coudes, genoux et travail au corps à corps.",
    family: "striking",
  },
  {
    name: "Full contact",
    description: "Cours pieds-poings en distance, cardio et assauts contrôlés.",
    family: "striking",
  },
  {
    name: "Sanda",
    description: "Boxe chinoise avec frappes, projections et travail de timing.",
    family: "striking",
  },
  {
    name: "MMA",
    description: "Cours mixte debout-sol pour adultes ou compétition.",
    family: "grappling",
  },
  {
    name: "Judo",
    description: "Cours de projections, contrôles au sol et progression par niveaux.",
    family: "grappling",
  },
  {
    name: "Jiu-jitsu bresilien",
    description: "Cours de grappling, soumissions et contrôles au sol.",
    family: "grappling",
  },
  {
    name: "Grappling No-Gi",
    description: "Cours de lutte au sol sans kimono, passages de garde et soumissions.",
    family: "grappling",
  },
  {
    name: "Lutte",
    description: "Cours de projections, contrôles, lutte debout et au sol.",
    family: "grappling",
  },
  {
    name: "Sambo",
    description: "Cours de projections, contrôles et soumissions selon le format du club.",
    family: "grappling",
  },
  {
    name: "Karate",
    description: "Cours technique, kata, combat et préparation aux grades.",
    family: "traditional",
  },
  {
    name: "Kyokushin",
    description: "Karaté plein contact, condition physique et progression technique.",
    family: "traditional",
  },
  {
    name: "Taekwondo",
    description: "Cours orienté coups de pied, souplesse, combat et grades.",
    family: "traditional",
  },
  {
    name: "Aikido",
    description: "Cours de placements, contrôles articulaires et travail avec partenaire.",
    family: "traditional",
  },
  {
    name: "Kung Fu",
    description: "Cours technique traditionnel, formes, coordination et combat.",
    family: "traditional",
  },
  {
    name: "Wing Chun",
    description: "Cours de distance courte, structure, réflexes et enchaînements.",
    family: "traditional",
  },
  {
    name: "Self Defense",
    description: "Cours pratique pour réflexes, sorties de saisie et sécurité personnelle.",
    family: "self-defense",
  },
  {
    name: "Krav Maga",
    description: "Cours orienté protection personnelle, scénarios et réactions simples.",
    family: "self-defense",
  },
  {
    name: "Capoeira",
    description: "Cours mêlant mouvement, rythme, acrobaties et culture martiale.",
    family: "traditional",
  },
  {
    name: "Kendo",
    description: "Cours avec shinai, déplacements, assauts et étiquette martiale.",
    family: "weapons",
  },
  {
    name: "Iaido",
    description: "Cours de formes au sabre, précision, posture et concentration.",
    family: "weapons",
  },
];
