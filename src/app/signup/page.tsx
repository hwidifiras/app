import type { Metadata } from "next";

import { SignupPlatformShell } from "@/components/signup/signup-platform-shell";
import { SignupWizard } from "@/components/signup/signup-wizard";
import { requirePlatformPage } from "@/platform/signup/platform-page";
import { getPublicSignupConfig } from "@/platform/signup/public-signup-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Créer votre espace | We Discipline",
  description: "Configurez votre club, vos activités et vos accès dans un espace sécurisé.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  await requirePlatformPage(invite ? `/signup?invite=${encodeURIComponent(invite)}` : "/signup");

  return (
    <SignupPlatformShell>
      <SignupWizard config={getPublicSignupConfig()} inviteToken={invite} />
    </SignupPlatformShell>
  );
}
