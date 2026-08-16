import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/request-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  return NextResponse.json({ data: user });
}
