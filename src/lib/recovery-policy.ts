export type RecoveryPolicy = {
  area: string;
  action: string;
  normalUserCopy: string;
  behavior: "edit" | "correct" | "reverse" | "void" | "archive" | "close" | "draft-delete";
  reasonRequired: boolean;
  preservesHistory: boolean;
};

export const RECOVERY_POLICIES: RecoveryPolicy[] = [
  {
    area: "payments",
    action: "payment-created",
    normalUserCopy: "Encaissement",
    behavior: "reverse",
    reasonRequired: true,
    preservesHistory: true,
  },
  {
    area: "payments",
    action: "payment-corrected",
    normalUserCopy: "Correction avec motif",
    behavior: "correct",
    reasonRequired: true,
    preservesHistory: true,
  },
  {
    area: "receipts",
    action: "receipt-voided",
    normalUserCopy: "Recu annule",
    behavior: "void",
    reasonRequired: true,
    preservesHistory: true,
  },
  {
    area: "enrollment",
    action: "enrollment-voided",
    normalUserCopy: "Inscription annulee",
    behavior: "void",
    reasonRequired: true,
    preservesHistory: true,
  },
  {
    area: "members",
    action: "member-archived",
    normalUserCopy: "Eleve archive",
    behavior: "archive",
    reasonRequired: false,
    preservesHistory: true,
  },
  {
    area: "group-members",
    action: "assignment-closed",
    normalUserCopy: "Affectation fermee",
    behavior: "close",
    reasonRequired: false,
    preservesHistory: true,
  },
  {
    area: "attendance",
    action: "attendance-corrected",
    normalUserCopy: "Pointage corrige",
    behavior: "correct",
    reasonRequired: true,
    preservesHistory: true,
  },
  {
    area: "catalog",
    action: "unused-draft-removed",
    normalUserCopy: "Brouillon supprime",
    behavior: "draft-delete",
    reasonRequired: false,
    preservesHistory: false,
  },
];

export function policyForAction(action: string): RecoveryPolicy | null {
  return RECOVERY_POLICIES.find((policy) => policy.action === action) ?? null;
}
