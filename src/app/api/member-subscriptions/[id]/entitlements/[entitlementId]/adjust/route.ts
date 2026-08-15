import { NextResponse } from "next/server";

import {
  describeIdempotencyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { entitlementAdjustmentSchema } from "@/lib/schemas/subscription-lifecycle";
import { adjustEntitlementUnits } from "@/modules/sales/subscription-lifecycle-service";

export const runtime = "nodejs";

const errorMessages: Record<string, { status: number; error: string }> = {
  ENTITLEMENT_NOT_FOUND: { status: 404, error: "Droit d'abonnement introuvable" },
  SUBSCRIPTION_CANCELLED: { status: 409, error: "Un abonnement résilié ne peut pas être corrigé" },
  UNLIMITED_ENTITLEMENT: { status: 409, error: "Un accès illimité n'a pas de solde à corriger" },
  NEGATIVE_ENTITLEMENT_BALANCE: { status: 409, error: "Le solde du droit ne peut pas devenir négatif" },
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; entitlementId: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(request, "subscriptions.correct");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }
  const { id, entitlementId } = await context.params;
  const parsed = entitlementAdjustmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const outcome = await runIdempotentSerializableTransaction(
      {
        tenantId: actor.tenantId,
        scope: "subscriptions:entitlement-adjust",
        idempotencyKey: readIdempotencyKey(request),
        requestPayload: { subscriptionId: id, entitlementId, ...parsed.data },
      },
      async (tx) => ({
        status: 201,
        body: {
          data: await adjustEntitlementUnits(tx, {
            tenantId: actor.tenantId,
            subscriptionId: id,
            entitlementId,
            unitsDelta: parsed.data.unitsDelta,
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
    console.error("[POST subscription entitlement adjustment]", error);
    return NextResponse.json({ error: "Correction impossible" }, { status: 500 });
  }
}
