import type { RequestUser } from "@/lib/request-user";
import { prisma } from "@/lib/prisma";

type CoachQualificationRecord = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  sportId: string | null;
  qualifications: Array<{ sportId: string }>;
};

export type CoachSportEligibilityResult =
  | {
      ok: true;
      overrideUsed: boolean;
      overrideReason: string | null;
      coach: { id: string; name: string };
      sport: { id: string; name: string };
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    };

export function coachQualifiedSportIds(
  coach: Pick<CoachQualificationRecord, "sportId" | "qualifications">,
) {
  return Array.from(
    new Set([
      ...(coach.sportId ? [coach.sportId] : []),
      ...coach.qualifications.map((qualification) => qualification.sportId),
    ]),
  );
}

export function normalizeCoachSportIds(
  sportIds: Array<string | null | undefined> | null | undefined,
  primarySportId?: string | null,
) {
  const normalized = new Set<string>();

  for (const sportId of sportIds ?? []) {
    const value = sportId?.trim();
    if (value) normalized.add(value);
  }

  const primary = primarySportId?.trim();
  if (primary) normalized.add(primary);

  return Array.from(normalized);
}

export async function validateCoachSportEligibility(params: {
  coachId: string;
  sportId: string;
  actor: RequestUser;
  overrideReason?: string | null;
}): Promise<CoachSportEligibilityResult> {
  const [coach, sport] = await Promise.all([
    prisma.coach.findUnique({
      where: { id: params.coachId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
        sportId: true,
        qualifications: { select: { sportId: true } },
      },
    }),
    prisma.sport.findUnique({
      where: { id: params.sportId },
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  if (!sport) {
    return { ok: false, status: 404, code: "SPORT_NOT_FOUND", error: "Sport introuvable" };
  }

  if (!coach) {
    return { ok: false, status: 404, code: "COACH_NOT_FOUND", error: "Coach introuvable" };
  }

  if (!coach.isActive) {
    return { ok: false, status: 409, code: "COACH_INACTIVE", error: "Ce coach est inactif" };
  }

  if (!sport.isActive) {
    return { ok: false, status: 409, code: "SPORT_INACTIVE", error: "Cette discipline est inactive" };
  }

  const qualifiedSportIds = coachQualifiedSportIds(coach);
  const coachName = `${coach.firstName} ${coach.lastName}`;

  if (qualifiedSportIds.includes(params.sportId)) {
    return {
      ok: true,
      overrideUsed: false,
      overrideReason: null,
      coach: { id: coach.id, name: coachName },
      sport: { id: sport.id, name: sport.name },
    };
  }

  if (params.actor.role !== "ADMIN") {
    return {
      ok: false,
      status: 403,
      code: "COACH_NOT_QUALIFIED",
      error: `${coachName} n'est pas qualifie pour ${sport.name}. Demandez une validation admin.`,
    };
  }

  const reason = params.overrideReason?.trim() ?? "";
  if (reason.length === 0) {
    return {
      ok: false,
      status: 409,
      code: "COACH_OVERRIDE_REASON_REQUIRED",
      error: `Motif admin requis pour assigner ${coachName} a ${sport.name}.`,
    };
  }

  return {
    ok: true,
    overrideUsed: true,
    overrideReason: reason,
    coach: { id: coach.id, name: coachName },
    sport: { id: sport.id, name: sport.name },
  };
}

export function coachSportOverrideAuditDetails(
  result: Extract<CoachSportEligibilityResult, { ok: true }>,
  extra: Record<string, unknown> = {},
) {
  if (!result.overrideUsed) return null;

  return JSON.stringify({
    coachId: result.coach.id,
    coachName: result.coach.name,
    sportId: result.sport.id,
    sportName: result.sport.name,
    overrideReason: result.overrideReason,
    ...extra,
  });
}
