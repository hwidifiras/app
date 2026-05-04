import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE_NAME = "gym_auth";

export type AuthRole = "ADMIN" | "STAFF";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  name: string;
  role: AuthRole;
};

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing AUTH_SECRET env var");
    }

    // Dev fallback: keeps local setup friction low.
    return new TextEncoder().encode("dev-insecure-secret-change-me");
  }

  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getAuthSecret());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());

    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    const role = payload.role;
    if (role !== "ADMIN" && role !== "STAFF") {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role,
    };
  } catch {
    return null;
  }
}
