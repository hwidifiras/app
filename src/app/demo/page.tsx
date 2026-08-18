import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MonitorOff } from "lucide-react";

import { demoWorkspaceEntryUrl } from "@/lib/demo-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Démo du logiciel | We Discipline",
  description:
    "Explorez le véritable espace We Discipline avec des données de club fictives et protégées.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoPage() {
  const entryUrl = demoWorkspaceEntryUrl();
  if (entryUrl) redirect(entryUrl);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F9FF] px-5 py-12">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <MonitorOff className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">
          Démo temporairement indisponible
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          L&apos;espace de démonstration n&apos;est pas configuré sur cet environnement.
        </p>
        <Link
          href="/accueil"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au site
        </Link>
      </section>
    </main>
  );
}
