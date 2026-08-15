import { checkDatabaseReadiness } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await checkDatabaseReadiness();
    return Response.json({ status: "ready", checks: { database: "up" } });
  } catch {
    return Response.json(
      { status: "not_ready", checks: { database: "down" } },
      { status: 503 },
    );
  }
}
