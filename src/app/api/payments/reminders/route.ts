import { NextResponse } from "next/server";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { sendPaymentReminders } from "@/lib/payment-reminders";
import { sendPaymentRemindersSchema } from "@/lib/schemas/payment-reminder";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "payments.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = sendPaymentRemindersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results = await sendPaymentReminders(parsed.data.memberIds, {
    actorUserId: actor.id,
    force: parsed.data.force === true,
  });

  const sent = results.filter((result) => result.status === "sent").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return NextResponse.json({
    data: {
      results,
      summary: { sent, skipped, failed, total: results.length },
    },
  });
}
