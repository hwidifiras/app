"use client";

import { SetupGuide } from "@/components/onboarding/setup-guide";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** Barre horizontale desktop (guide + thème), au-dessus du contenu principal. */
export function DesktopTopNav() {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:block">
      <div className="flex min-h-[3.25rem] items-center justify-end gap-3 px-5 py-2">
        <SetupGuide variant="header" />
        <div className="w-[min(100%,14rem)]">
          <ThemeToggle compact />
        </div>
      </div>
    </header>
  );
}
