import type { Prisma } from "@prisma/client";

type InsuranceDb = Pick<Prisma.TransactionClient, "clubSettings" | "memberSubscription">;

export type AnnualInsuranceCharge = {
  feeCents: number;
  insuranceYear: number | null;
};

export function annualInsuranceYearFor(startDate: Date): number {
  return startDate.getUTCFullYear();
}

export function annualInsuranceValidUntil(lastInsuranceStartDate: Date): Date {
  const validUntil = new Date(lastInsuranceStartDate);
  validUntil.setUTCFullYear(validUntil.getUTCFullYear() + 1);
  return validUntil;
}

export function calculateAnnualInsuranceCharge(input: {
  configuredFeeCents: number;
  lastInsuranceStartDate?: Date | null;
  startDate: Date;
}): AnnualInsuranceCharge {
  const feeCents = Math.max(0, input.configuredFeeCents);
  const coveredUntil = input.lastInsuranceStartDate
    ? annualInsuranceValidUntil(input.lastInsuranceStartDate)
    : null;
  if (feeCents === 0 || (coveredUntil && input.startDate < coveredUntil)) {
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

  const existing = await db.memberSubscription.findFirst({
    where: {
      tenantId: input.tenantId,
      memberId: input.memberId,
      insuranceCoverageDate: { not: null },
    },
    orderBy: { insuranceCoverageDate: "desc" },
    select: { insuranceCoverageDate: true },
  });

  return calculateAnnualInsuranceCharge({
    configuredFeeCents: feeCents,
    lastInsuranceStartDate: existing?.insuranceCoverageDate ?? null,
    startDate: input.startDate,
  });
}
