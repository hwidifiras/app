import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const CODE_DIGITS = 6;

function signupSecret(): string {
  const secret = process.env.SIGNUP_TOKEN_SECRET?.trim()
    || (process.env.NODE_ENV !== "production" ? process.env.AUTH_SECRET?.trim() : "");
  if (!secret || secret.length < 32) throw new Error("SIGNUP_TOKEN_SECRET_MISSING");
  return secret;
}

function hmac(namespace: string, value: string): string {
  return createHmac("sha256", signupSecret())
    .update(`we-discipline:${namespace}:v1:${value}`)
    .digest("hex");
}

export function createSignupVerificationSecrets(signupId: string) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const code = String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
  return {
    token,
    code,
    tokenHash: hashSignupVerificationToken(signupId, token),
    codeHash: hashSignupVerificationCode(signupId, code),
  };
}

export function createWorkspaceHandoffSecret(tenantId: string, userId: string) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashWorkspaceHandoffToken(tenantId, userId, token),
  };
}

export function hashSignupVerificationToken(signupId: string, token: string): string {
  return hmac("signup-verification-token", `${signupId}:${token.trim()}`);
}

export function hashSignupVerificationCode(signupId: string, code: string): string {
  return hmac("signup-verification-code", `${signupId}:${code.trim()}`);
}

export function hashWorkspaceHandoffToken(tenantId: string, userId: string, token: string): string {
  return hmac("workspace-handoff", `${tenantId}:${userId}:${token.trim()}`);
}

export function hashSignupInviteToken(token: string): string {
  return hmac("signup-invite", token.trim());
}

export function hashSignupIdempotencyKey(key: string): string {
  return hmac("signup-idempotency", key.trim());
}

export function signupRateLimitKey(namespace: string, value: string): string {
  return hmac(`rate-limit:${namespace}`, value.trim().toLowerCase()).slice(0, 40);
}

export function signupRequestFingerprint(clientIp: string, email: string): string {
  return hmac("signup-request", `${clientIp}:${email.trim().toLowerCase()}`).slice(0, 32);
}

export function secureHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
