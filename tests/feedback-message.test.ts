import { describe, expect, it } from "vitest";

import { inferFeedbackVariant } from "@/components/ui/feedback-message";

describe("feedback message variant inference", () => {
  it("keeps non-destructive action successes green", () => {
    expect(inferFeedbackVariant("Offre désactivée des offres actives.")).toBe("success");
    expect(inferFeedbackVariant("Retrait terminé: 2 affectation(s) fermée(s).")).toBe("success");
    expect(inferFeedbackVariant("Cours désactivé. Les séances et l'historique restent consultables.")).toBe("success");
    expect(inferFeedbackVariant("Dernier paiement annulé.")).toBe("success");
  });

  it("keeps error wording red even when it mentions cancellation", () => {
    expect(inferFeedbackVariant("Impossible d'annuler le paiement.")).toBe("error");
    expect(inferFeedbackVariant("Ce paiement est déjà annulé.")).toBe("error");
    expect(inferFeedbackVariant("Erreur lors de la résiliation")).toBe("error");
  });

  it("uses info for neutral empty or already-state messages", () => {
    expect(inferFeedbackVariant("Aucun membre éligible pour un rappel email.")).toBe("info");
    expect(inferFeedbackVariant("Cette ligne est déjà une correction ou une annulation.")).toBe("info");
  });
});
