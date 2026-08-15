export type GymAccessDecisionDto = {
  allowed: boolean;
  override: boolean;
  code: string | null;
  message: string;
  member: { id: string; firstName: string; lastName: string; phone: string } | null;
  entitlement: {
    id: string;
    planName: string;
    accessMode: "UNLIMITED" | "VISIT_QUOTA";
    remainingUnits: number | null;
    endDate: string | null;
    amount: number;
    totalPaid: number;
    effectiveState?: string;
  } | null;
  visitsToday?: number;
  lastVisitAt?: string | null;
};
