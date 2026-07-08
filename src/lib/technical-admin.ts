import type { RequestUser } from "@/lib/request-user";

const DEFAULT_TECHNICAL_ADMIN_EMAILS = ["hwidifiras@gmail.com"];

function configuredTechnicalAdminEmails() {
  const raw =
    process.env.TECHNICAL_CLEANUP_ADMINS?.trim() ||
    process.env.SUPER_ADMIN_EMAILS?.trim() ||
    "";

  const configured = raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_TECHNICAL_ADMIN_EMAILS;
}

export function isTechnicalAdmin(user: Pick<RequestUser, "email" | "role">) {
  if (user.role !== "ADMIN") return false;
  return configuredTechnicalAdminEmails().includes(user.email.toLowerCase());
}
