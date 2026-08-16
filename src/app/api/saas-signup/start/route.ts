import { randomUUID } from "node:crypto";

import { getClientIp } from "@/lib/rate-limit";
import { noStoreJson, serializeSignupState, signupErrorResponse } from "@/platform/signup/signup-api";
import { startWorkspaceSignup } from "@/platform/signup/signup-account-service";
import { verifySignupAntiBot } from "@/platform/signup/signup-anti-bot";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { enforceSignupRateLimit } from "@/platform/signup/signup-rate-limit";
import { signupStartSchema } from "@/platform/signup/signup-schemas";
import { setSignupSessionCookie } from "@/platform/signup/signup-session";

export const runtime = "nodejs";

const HOUR_MS = 60 * 60 * 1_000;

export async function POST(request: Request) {
  try {
    requirePlatformRequest(request);
    requireTrustedMutationOrigin(request);
    const clientIp = getClientIp(request);
    await enforceSignupRateLimit({ namespace: "start-ip", value: clientIp, limit: 10, windowMs: HOUR_MS });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: "Données invalides." }, { status: 400 });
    }
    const parsed = signupStartSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: "Vérifiez les informations saisies.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await enforceSignupRateLimit({
      namespace: "start-email",
      value: parsed.data.email,
      limit: 5,
      windowMs: HOUR_MS,
    });
    await verifySignupAntiBot({ token: parsed.data.antiBotToken, remoteIp: clientIp });

    const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim() || randomUUID();
    if (rawIdempotencyKey.length < 8 || rawIdempotencyKey.length > 200) {
      throw new SignupServiceError("SIGNUP_REQUEST_CONFLICT", 400);
    }
    const result = await startWorkspaceSignup({
      data: parsed.data,
      clientIp,
      idempotencyKey: rawIdempotencyKey,
    });
    const stage = result.state.emailVerified ? "VERIFIED" : "PENDING_EMAIL";
    await setSignupSessionCookie({ signupId: result.state.signupId, stage });
    return noStoreJson(
      {
        data: {
          signup: serializeSignupState(result.state),
          reused: result.reused,
          emailSent: result.delivery?.delivered ?? null,
          emailWarning: result.delivery && !result.delivery.delivered ? result.delivery.reason : undefined,
          developmentVerification: result.developmentVerification,
        },
      },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    return signupErrorResponse(error);
  }
}
