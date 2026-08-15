import { NextResponse } from "next/server";

import {
  describeIdempotencyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { subscriptionLifecycleReasonSchema } from "@/lib/schemas/subscription-lifecycle";
import { pauseSubscription } from "@/modules/sales/subscription-lifecycle-service";

export const runtime = "nodejs";

const errorMessages: Record<string, { status: number; error: string }> = {
  SUBSCRIPTION_NOT_FOUND: { status: 404, error: "Abonnement introuvable" },
  FREEZE_NOT_ALLOWED: { status: 409, error: "Cette formule ne permet pas de pause" },
  SUBSCRIPTION_ALREADY_FROZEN: { status: 409, error: "Cet abonnement est déjà en pause" },
  SUBSCRIPTION_NOT_ACTIVE: { status: 409, error: "Seul un abonnement actif peut être mis en pause" },
  SUBSCRIPTION_HAS_QUEUED_RENEWAL: { status: 409, error: "Annulez ou traitez d'abord le renouvellement déjà planifié." },
  FREEZE_COUNT_EXHAUSTED: { status: 409, error: "Le nombre de pauses autorisées est atteint" },
  FREEZE_DAYS_EXHAUSTED: { status: 409, error: "La durée totale de pause autorisée est atteinte" },
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
        scope: "subscriptions:pause",
        idempotencyKey: readIdempotencyKey(request),
        requestPayload: { subscriptionId: id, ...parsed.data },
      },
      async (tx) => ({
        status: 201,
        body: {
          data: await pauseSubscription(tx, {
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
    console.error("[POST subscription pause]", error);
    return NextResponse.json({ error: "Mise en pause impossible" }, { status: 500 });
  }
}
