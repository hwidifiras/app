"use client";

import { SetupGuide } from "@/components/onboarding/setup-guide";
import { UserAccountMenu } from "@/components/layout/user-account-menu";

/** Barre horizontale desktop (guide + compte), au-dessus du contenu principal. */
export function DesktopTopNav() {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:block">
      <div className="flex min-h-[3.25rem] items-center justify-end gap-3 px-5 py-2">
        <SetupGuide variant="header" />
        <UserAccountMenu />
      </div>
    </header>
  );
}
