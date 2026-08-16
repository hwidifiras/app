export type SignupErrorCode =
  | "SIGNUP_DISABLED"
  | "SIGNUP_INVITE_REQUIRED"
  | "SIGNUP_INVITE_INVALID"
  | "SIGNUP_SESSION_INVALID"
  | "SIGNUP_EXPIRED"
  | "SIGNUP_NOT_VERIFIED"
  | "SIGNUP_VERIFICATION_INVALID"
  | "SIGNUP_VERIFICATION_LOCKED"
  | "SIGNUP_RESEND_COOLDOWN"
  | "SIGNUP_ALREADY_COMPLETED"
  | "SIGNUP_REQUEST_CONFLICT"
  | "SIGNUP_RATE_LIMITED"
  | "SIGNUP_RATE_LIMIT_UNAVAILABLE"
  | "ANTI_BOT_REQUIRED"
  | "ANTI_BOT_FAILED"
  | "ANTI_BOT_UNAVAILABLE"
  | "PLATFORM_HOST_REQUIRED"
  | "UNTRUSTED_ORIGIN"
  | "SLUG_INVALID"
  | "SLUG_UNAVAILABLE"
  | "EDITION_NOT_ALLOWED"
  | "ACTIVITY_TEMPLATE_INVALID"
  | "SAAS_PLAN_UNAVAILABLE"
  | "SAAS_PLAN_CONFIGURATION_INVALID"
  | "PROVISIONING_FAILED"
  | "HANDOFF_INVALID";

export class SignupServiceError extends Error {
  constructor(
    public readonly code: SignupErrorCode,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "SignupServiceError";
  }
}

export function isSignupServiceError(error: unknown): error is SignupServiceError {
  return error instanceof SignupServiceError;
}
