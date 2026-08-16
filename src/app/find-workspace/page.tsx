import type { Metadata } from "next";
import Link from "next/link";

import { FindWorkspaceForm } from "@/components/signup/find-workspace-form";
import { SignupPlatformShell } from "@/components/signup/signup-platform-shell";
import { requirePlatformPage } from "@/platform/signup/platform-page";
import { getPublicSignupConfig } from "@/platform/signup/public-signup-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trouver votre espace | We Discipline",
};

export default async function FindWorkspacePage() {
  await requirePlatformPage("/find-workspace");
  const config = getPublicSignupConfig();

  return (
    <SignupPlatformShell compact>
      <section className="panel overflow-hidden">
        <div className="border-b border-[#D8E2F0] px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-xs font-bold uppercase text-[#2563EB]">Connexion club</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-[#0B1220]">Retrouvez votre espace</h1>
          <p className="mt-2 text-sm leading-6 text-[#52647A]">Saisissez l’adresse choisie par votre club pour rejoindre sa page de connexion.</p>
        </div>
        <div className="p-5 sm:p-7">
          <FindWorkspaceForm workspaceDomain={config.workspaceDomain} />
          <p className="mt-5 border-t border-[#D8E2F0] pt-5 text-center text-sm text-[#64748B]">
            Nouveau club ? <Link href="/signup" className="font-bold text-[#2563EB] hover:underline">Créer un espace</Link>
          </p>
        </div>
      </section>
    </SignupPlatformShell>
  );
}
