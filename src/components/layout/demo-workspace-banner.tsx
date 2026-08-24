"use client";

import Link from "next/link";
import { Eye, LockKeyhole } from "lucide-react";

import { useAppShellData } from "@/components/layout/app-shell-data-provider";

export function DemoWorkspaceBanner() {
  const { account } = useAppShellData();
  if (!account?.isDemoWorkspace) return null;

  return (
    <div
      className="print:hidden"
      role="note"
      aria-label="Espace de démonstration"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-950 lg:px-5">
        <Eye className="size-4 shrink-0" aria-hidden="true" />
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-blue-800">
          <LockKeyhole className="size-3" aria-hidden="true" />
          Lecture seule
        </span>
        <p className="min-w-[14rem] flex-1 leading-5">
          <strong>Démo We Discipline.</strong>{" "}
          Explorez les pages et les données fictives. Enregistrer, envoyer et supprimer sont désactivés ; recherche, filtres et navigation restent disponibles.
        </p>
        <Link
          href="/accueil"
          className="shrink-0 font-semibold underline underline-offset-2"
        >
          Quitter
        </Link>
      </div>
    </div>
  );
}
