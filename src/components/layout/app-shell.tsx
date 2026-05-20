"use client";

import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { DesktopTopNav } from "@/components/layout/desktop-top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  if (isAuthRoute) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed right-3 top-3 z-50 w-[min(100%,14rem)] sm:right-4 sm:top-4">
          <ThemeToggle compact />
        </div>
        {children}
      </div>
    );
  }

  return (
    <>
      <MobileNav />
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <AppSidebar />
        <div className="flex min-w-0 flex-col bg-gradient-to-b from-[var(--surface)]/40 via-transparent to-transparent dark:from-[var(--background)]/80">
          <DesktopTopNav />
          {children}
        </div>
      </div>
    </>
  );
}
