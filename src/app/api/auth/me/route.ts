import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/request-user";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({ data: user });
}
