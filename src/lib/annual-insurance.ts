import type { Prisma } from "@prisma/client";

type InsuranceDb = Pick<Prisma.TransactionClient, "clubSettings" | "memberSubscription">;

export type AnnualInsuranceCharge = {
  feeCents: number;
  insuranceYear: number | null;
};

export function annualInsuranceYearFor(startDate: Date): number {
  return startDate.getUTCFullYear();
}

export function calculateAnnualInsuranceCharge(input: {
  configuredFeeCents: number;
  alreadyInsured: boolean;
  startDate: Date;
}): AnnualInsuranceCharge {
  const feeCents = Math.max(0, input.configuredFeeCents);
  if (feeCents === 0 || input.alreadyInsured) {
    return { feeCents: 0, insuranceYear: null };
  }
  return { feeCents, insuranceYear: annualInsuranceYearFor(input.startDate) };
}

export async function getAnnualInsuranceFeeCents(
  db: InsuranceDb,
  tenantId: string,
): Promise<number> {
  const settings = await db.clubSettings.findFirst({
    where: { tenantId },
    select: { annualInsuranceFeeCents: true },
  });
  return Math.max(0, settings?.annualInsuranceFeeCents ?? 0);
}

export async function resolveAnnualInsuranceCharge(
  db: InsuranceDb,
  input: { tenantId: string; memberId: string; startDate: Date },
): Promise<AnnualInsuranceCharge> {
  const feeCents = await getAnnualInsuranceFeeCents(db, input.tenantId);
  if (feeCents === 0) return { feeCents: 0, insuranceYear: null };

  const insuranceYear = annualInsuranceYearFor(input.startDate);
  const existing = await db.memberSubscription.findFirst({
    where: {
      tenantId: input.tenantId,
      memberId: input.memberId,
      insuranceYear,
    },
    select: { id: true },
  });

  return calculateAnnualInsuranceCharge({
    configuredFeeCents: feeCents,
    alreadyInsured: Boolean(existing),
    startDate: input.startDate,
  });
}
