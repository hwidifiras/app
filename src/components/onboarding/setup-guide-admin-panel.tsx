"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";

import type { SetupGuideProgress } from "@/lib/setup-guide";

const DISMISS_KEY = "gymday-setup-guide-dismissed";

type SetupGuideAdminPanelProps = {
  progress: SetupGuideProgress;
};

export function SetupGuideAdminPanel({ progress }: SetupGuideAdminPanelProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  function resetDismiss() {
    localStorage.removeItem(DISMISS_KEY);
    window.location.reload();
  }

  const hiddenReasons: string[] = [];
  if (progress.isComplete) {
    hiddenReasons.push("Toutes les étapes sont déjà remplies dans la base (discipline, coach, cours, formule, élève).");
  }
  if (dismissed) {
    hiddenReasons.push('Guide masqué dans ce navigateur (bouton « Masquer » ou localStorage).');
  }

  return (
    <section className="panel panel-soft mt-6 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Guide « Premiers pas » (diagnostic)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Ce guide ne dépend pas d’un compte utilisateur « nouveau ». Il s’affiche tant que le club n’a pas encore
        les données de base. Même compte admin : si la base est déjà remplie (seed), le bouton reste caché.
      </p>

      <p className="mt-3 text-sm">
        Progression :{" "}
        <span className="font-semibold text-foreground">
          {progress.completedCount}/{progress.totalCount}
        </span>
        {progress.isComplete ? (
          <span className="ml-2 text-[var(--success)]">— terminé</span>
        ) : (
          <span className="ml-2 text-primary">— {progress.pendingCount} étape(s) restante(s)</span>
        )}
      </p>

      <ul className="mt-3 space-y-1.5">
        {progress.steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <Check className="size-4 shrink-0 text-[var(--success)]" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={step.done ? "text-muted-foreground line-through" : "font-medium text-foreground"}>
              {step.order}. {step.label}
            </span>
            {!step.done ? (
              <Link href={step.href} className="text-xs text-primary underline">
                Ouvrir
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {hiddenReasons.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Pourquoi le guide n’apparaît pas :</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {hiddenReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Le bouton « Premiers pas » doit être visible : en-tête mobile (à côté du menu) et barre du haut desktop (à droite, avec le thème).
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={resetDismiss}>
          Réafficher le guide (ce navigateur)
        </button>
        <a href="/api/setup-guide" target="_blank" rel="noreferrer" className="btn btn-ghost text-xs">
          Voir JSON API
        </a>
      </div>

      {dismissed ? (
        <p className="mt-2 text-[0.65rem] text-muted-foreground">
          Astuce : cliquez « Réafficher » puis rechargez — utile seulement si des étapes sont encore en attente.
        </p>
      ) : null}
    </section>
  );
}
