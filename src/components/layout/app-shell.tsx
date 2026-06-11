"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { DesktopTopNav } from "@/components/layout/desktop-top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggleCollapsed: () => {},
});

export function useSidebarLayout() {
  return useContext(SidebarContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const isAuthRoute =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  if (isAuthRoute) {
    return <div className="relative min-h-screen">{children}</div>;
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>
      <MobileNav />
      <div
        className={`grid min-h-screen ${collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[240px_1fr]"}`}
      >
        <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex min-w-0 flex-col bg-gradient-to-b from-[var(--surface)]/40 via-transparent to-transparent dark:from-[var(--background)]/80">
          <DesktopTopNav />
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
