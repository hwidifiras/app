"use client";

import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/login/");

  if (isAuthRoute) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <>
      <MobileNav />
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <AppSidebar />
        <div className="min-w-0 bg-gradient-to-b from-white/35 via-white/10 to-transparent">
          {children}
        </div>
      </div>
    </>
  );
}
