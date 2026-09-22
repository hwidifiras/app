import type { Prisma } from "@prisma/client";

type InsuranceDb = Pick<Prisma.TransactionClient, "clubSettings" | "memberInsuranceCoverage">;

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

  const existing = await db.memberInsuranceCoverage.findFirst({
    where: {
      tenantId: input.tenantId,
      memberId: input.memberId,
      status: "ACTIVE",
      coverageStart: { lte: input.startDate },
      coverageEnd: { gt: input.startDate },
    },
    orderBy: { coverageEnd: "desc" },
    select: { coverageStart: true },
  });

  return calculateAnnualInsuranceCharge({
    configuredFeeCents: feeCents,
    lastInsuranceStartDate: existing?.coverageStart ?? null,
    startDate: input.startDate,
  });
}

export async function recordAnnualInsuranceCoverage(
  db: InsuranceDb,
  input: {
    tenantId: string;
    memberId: string;
    subscriptionId: string;
    coverageStart: Date | null;
    amountCents: number;
  },
) {
  if (!input.coverageStart) return null;

  const coverageEnd = annualInsuranceValidUntil(input.coverageStart);
  const source = input.amountCents > 0 ? "SUBSCRIPTION" as const : "HISTORICAL" as const;

  return db.memberInsuranceCoverage.upsert({
    where: { subscriptionId: input.subscriptionId },
    update: {
      tenantId: input.tenantId,
      memberId: input.memberId,
      coverageStart: input.coverageStart,
      coverageEnd,
      amountCents: Math.max(0, input.amountCents),
      source,
      status: "ACTIVE",
      voidedAt: null,
      voidReason: null,
    },
    create: {
      tenantId: input.tenantId,
      memberId: input.memberId,
      subscriptionId: input.subscriptionId,
      coverageStart: input.coverageStart,
      coverageEnd,
      amountCents: Math.max(0, input.amountCents),
      source,
    },
  });
}

export async function voidSubscriptionInsuranceCoverages(
  db: Pick<Prisma.TransactionClient, "memberInsuranceCoverage">,
  input: { tenantId?: string | null; subscriptionIds: string[]; reason: string; voidedAt?: Date },
) {
  if (input.subscriptionIds.length === 0) return { count: 0 };

  return db.memberInsuranceCoverage.updateMany({
    where: {
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      subscriptionId: { in: input.subscriptionIds },
      source: "SUBSCRIPTION",
      status: "ACTIVE",
    },
    data: {
      status: "VOIDED",
      voidedAt: input.voidedAt ?? new Date(),
      voidReason: input.reason,
    },
  });
}
