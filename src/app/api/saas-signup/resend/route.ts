import { getClientIp } from "@/lib/rate-limit";
import { resendWorkspaceVerification } from "@/platform/signup/signup-account-service";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { enforceSignupRateLimit } from "@/platform/signup/signup-rate-limit";
import { readSignupSession } from "@/platform/signup/signup-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requirePlatformRequest(request);
    requireTrustedMutationOrigin(request);
    const session = await readSignupSession();
    if (!session) throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);
    const clientIp = getClientIp(request);
    await Promise.all([
      enforceSignupRateLimit({ namespace: "resend-ip", value: clientIp, limit: 10, windowMs: 60 * 60 * 1_000 }),
      enforceSignupRateLimit({ namespace: "resend-signup", value: session.signupId, limit: 5, windowMs: 60 * 60 * 1_000 }),
    ]);
    const result = await resendWorkspaceVerification(session.signupId);
    return noStoreJson({
      data: {
        ok: true,
        emailSent: result.delivery.delivered,
        emailWarning: result.delivery.delivered ? undefined : result.delivery.reason,
        developmentVerification: result.developmentVerification,
      },
    });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
