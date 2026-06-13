import { cookies } from "next/headers";

import type { RequestUser } from "@/lib/request-user";

const COOKIE_NAME = "we_discipline_data_import";
const MODE_DURATION_SECONDS = 4 * 60 * 60;

export async function getDataImportMode(user: RequestUser) {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return { active: false as const, expiresAt: null };

  const [userId, expiresRaw] = value.split(".");
  const expiresAt = new Date(Number(expiresRaw));
  const active =
    userId === user.id &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt.getTime() > Date.now();

  return { active, expiresAt: active ? expiresAt : null };
}

export async function activateDataImportMode(user: RequestUser) {
  const expiresAt = new Date(Date.now() + MODE_DURATION_SECONDS * 1000);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${user.id}.${expiresAt.getTime()}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MODE_DURATION_SECONDS,
  });
  return expiresAt;
}

export async function deactivateDataImportMode() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
