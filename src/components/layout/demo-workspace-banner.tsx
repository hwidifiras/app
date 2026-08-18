"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { useAppShellData } from "@/components/layout/app-shell-data-provider";

export function DemoWorkspaceBanner() {
  const { account } = useAppShellData();
  if (!account?.isDemoWorkspace) return null;

  return (
    <div
      className="print:hidden"
      role="status"
      aria-label="Espace de démonstration"
    >
      <div className="flex items-start gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-950 lg:px-5">
        <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong>Démonstration We Discipline.</strong>{" "}
          Toutes les données sont fictives et les modifications sont désactivées.
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
