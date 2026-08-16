import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { shouldUseSecureCookies } from "@/lib/auth";

export const SIGNUP_SESSION_COOKIE = "wd_signup_session";
const SIGNUP_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export type SignupSessionStage = "PENDING_EMAIL" | "VERIFIED";

export type SignupSession = {
  signupId: string;
  stage: SignupSessionStage;
};

function sessionSecret(): Uint8Array {
  const secret = process.env.SIGNUP_TOKEN_SECRET?.trim()
    || (process.env.NODE_ENV !== "production" ? process.env.AUTH_SECRET?.trim() : "");
  if (!secret || secret.length < 32) throw new Error("SIGNUP_TOKEN_SECRET_MISSING");
  return new TextEncoder().encode(secret);
}

export async function signSignupSession(session: SignupSession): Promise<string> {
  return new SignJWT({ signupId: session.signupId, stage: session.stage })
    .setProtectedHeader({ alg: "HS256", typ: "signup+jwt" })
    .setIssuer("we-discipline-signup")
    .setAudience("we-discipline-platform")
    .setSubject(session.signupId)
    .setIssuedAt()
    .setExpirationTime(`${SIGNUP_SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionSecret());
}

export async function verifySignupSession(token: string): Promise<SignupSession | null> {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, sessionSecret(), {
      issuer: "we-discipline-signup",
      audience: "we-discipline-platform",
    });
    if (protectedHeader.typ !== "signup+jwt") return null;
    if (typeof payload.signupId !== "string") return null;
    if (payload.sub !== payload.signupId) return null;
    if (payload.stage !== "PENDING_EMAIL" && payload.stage !== "VERIFIED") return null;
    return { signupId: payload.signupId, stage: payload.stage };
  } catch {
    return null;
  }
}

export async function setSignupSessionCookie(session: SignupSession): Promise<void> {
  const token = await signSignupSession(session);
  const cookieStore = await cookies();
  cookieStore.set(SIGNUP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SIGNUP_SESSION_MAX_AGE_SECONDS,
  });
}

export async function readSignupSession(): Promise<SignupSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SIGNUP_SESSION_COOKIE)?.value;
  return token ? verifySignupSession(token) : null;
}

export async function clearSignupSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SIGNUP_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
