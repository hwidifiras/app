import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, shouldUseSecureCookies } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ data: { ok: true } });
}
