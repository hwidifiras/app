import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { signupRateLimitKey } from "@/platform/signup/signup-security";

export async function enforceSignupRateLimit(input: {
  namespace: string;
  value: string;
  limit: number;
  windowMs: number;
}): Promise<void> {
  const result: RateLimitResult = await checkRateLimit(
    `saas-signup:${input.namespace}:${signupRateLimitKey(input.namespace, input.value)}`,
    input.limit,
    input.windowMs,
  );
  if (result.allowed) return;
  throw new SignupServiceError(
    result.reason === "unavailable" ? "SIGNUP_RATE_LIMIT_UNAVAILABLE" : "SIGNUP_RATE_LIMITED",
    result.reason === "unavailable" ? 503 : 429,
    result.retryAfterSeconds,
  );
}
