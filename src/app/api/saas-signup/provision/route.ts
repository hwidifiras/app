import { getClientIp } from "@/lib/rate-limit";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { enforceSignupRateLimit } from "@/platform/signup/signup-rate-limit";
import { signupProvisionSchema } from "@/platform/signup/signup-schemas";
import { readSignupSession } from "@/platform/signup/signup-session";
import { provisionWorkspace } from "@/platform/signup/workspace-provisioning-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requirePlatformRequest(request);
    requireTrustedMutationOrigin(request);
    const session = await readSignupSession();
    if (!session || session.stage !== "VERIFIED") {
      throw new SignupServiceError("SIGNUP_NOT_VERIFIED", 403);
    }
    await Promise.all([
      enforceSignupRateLimit({ namespace: "provision-ip", value: getClientIp(request), limit: 10, windowMs: 60 * 60 * 1_000 }),
      enforceSignupRateLimit({ namespace: "provision-signup", value: session.signupId, limit: 5, windowMs: 60 * 60 * 1_000 }),
    ]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: "Données invalides." }, { status: 400 });
    }
    const parsed = signupProvisionSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: "Vérifiez les informations du club.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const result = await provisionWorkspace({ signupId: session.signupId, data: parsed.data });
    return noStoreJson({
      data: {
        tenantId: result.tenantId,
        tenantSlug: result.tenantSlug,
        trialEndsAt: result.trialEndsAt.toISOString(),
        handoff: result.handoff,
      },
    }, { status: 201 });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
