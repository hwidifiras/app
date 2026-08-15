import type { Prisma } from "@prisma/client";

import type { RequestUser } from "@/lib/request-user";

type CoachScopedUser = Pick<RequestUser, "role" | "coachId">;

export function isCoachScopedUser(user: CoachScopedUser): user is CoachScopedUser & { coachId: string } {
  return user.role === "STAFF" && Boolean(user.coachId);
}

export function coachSessionWhere(user: CoachScopedUser): Prisma.SessionWhereInput {
  if (!isCoachScopedUser(user)) return {};

  return {
    OR: [
      { coachId: user.coachId },
      { coachId: null, group: { coachId: user.coachId } },
    ],
  };
}

export function coachGroupWhere(user: CoachScopedUser): Prisma.GroupWhereInput {
  return isCoachScopedUser(user) ? { coachId: user.coachId } : {};
}

export function coachAttendanceWhere(user: CoachScopedUser): Prisma.AttendanceWhereInput {
  return isCoachScopedUser(user) ? { session: coachSessionWhere(user) } : {};
}
