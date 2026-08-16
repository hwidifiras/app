import { getClientIp } from "@/lib/rate-limit";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { enforceSignupRateLimit } from "@/platform/signup/signup-rate-limit";
import { readSignupSession } from "@/platform/signup/signup-session";
import { resumeCompletedWorkspace } from "@/platform/signup/workspace-provisioning-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requirePlatformRequest(request);
    requireTrustedMutationOrigin(request);
    const session = await readSignupSession();
    if (!session) throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);
    await Promise.all([
      enforceSignupRateLimit({ namespace: "handoff-ip", value: getClientIp(request), limit: 10, windowMs: 60 * 60 * 1_000 }),
      enforceSignupRateLimit({ namespace: "handoff-signup", value: session.signupId, limit: 5, windowMs: 60 * 60 * 1_000 }),
    ]);
    const result = await resumeCompletedWorkspace(session.signupId);
    return noStoreJson({
      data: {
        tenantId: result.tenantId,
        tenantSlug: result.tenantSlug,
        trialEndsAt: result.trialEndsAt.toISOString(),
        handoff: result.handoff,
      },
    });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
