import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  return NextResponse.json({ data: payload });
}
