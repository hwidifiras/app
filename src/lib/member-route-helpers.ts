import { NextResponse } from "next/server";

export function readMemberIdFromBody(body: unknown):
  | { ok: true; memberId: string }
  | { ok: false; response: NextResponse } {
  if (typeof body !== "object" || body === null || !("memberId" in body)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "memberId requis" }, { status: 400 }),
    };
  }

  const memberId = (body as { memberId?: unknown }).memberId;

  if (typeof memberId !== "string" || memberId.trim().length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "memberId invalide" }, { status: 400 }),
    };
  }

  return { ok: true, memberId };
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
