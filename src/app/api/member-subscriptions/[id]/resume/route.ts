import { NextResponse } from "next/server";

import {
  describeIdempotencyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { subscriptionLifecycleReasonSchema } from "@/lib/schemas/subscription-lifecycle";
import { resumeSubscription } from "@/modules/sales/subscription-lifecycle-service";

export const runtime = "nodejs";

const errorMessages: Record<string, { status: number; error: string }> = {
  SUBSCRIPTION_NOT_FOUND: { status: 404, error: "Abonnement introuvable" },
  SUBSCRIPTION_NOT_FROZEN: { status: 409, error: "Cet abonnement n'est pas en pause" },
  FREEZE_DAYS_EXCEEDED: { status: 409, error: "Cette reprise dépasserait la durée totale de pause autorisée" },
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requirePermission(request, "subscriptions.correct");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }
  const { id } = await context.params;
  const parsed = subscriptionLifecycleReasonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const outcome = await runIdempotentSerializableTransaction(
      {
        tenantId: actor.tenantId,
        scope: "subscriptions:resume",
        idempotencyKey: readIdempotencyKey(request),
        requestPayload: { subscriptionId: id, ...parsed.data },
      },
      async (tx) => ({
        status: 201,
        body: {
          data: await resumeSubscription(tx, {
            tenantId: actor.tenantId,
            subscriptionId: id,
            actorId: actor.id,
            reason: parsed.data.reason,
          }),
        },
      }),
    );
    return NextResponse.json(outcome.response.body, {
      status: outcome.response.status,
      headers: idempotencyResponseHeaders(outcome.replayed),
    });
  } catch (error) {
    const idempotency = describeIdempotencyError(error);
    if (idempotency) return NextResponse.json(idempotency, { status: idempotency.status });
    const mapped = error instanceof Error ? errorMessages[error.message] : null;
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[POST subscription resume]", error);
    return NextResponse.json({ error: "Reprise impossible" }, { status: 500 });
  }
}
