import type { Metadata } from "next";

import { SignupPlatformShell } from "@/components/signup/signup-platform-shell";
import { SignupVerifyLink } from "@/components/signup/signup-verify-link";
import { requirePlatformPage } from "@/platform/signup/platform-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmer votre email | We Discipline",
};

export default async function SignupVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string; token?: string }>;
}) {
  const { signup, token } = await searchParams;
  const target = new URLSearchParams();
  if (signup) target.set("signup", signup);
  if (token) target.set("token", token);
  await requirePlatformPage(`/signup/verify${target.size ? `?${target.toString()}` : ""}`);

  return (
    <SignupPlatformShell compact>
      <SignupVerifyLink signupId={signup} token={token} />
    </SignupPlatformShell>
  );
}
