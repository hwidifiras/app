"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { DesktopTopNav } from "@/components/layout/desktop-top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import {
  DISPLAY_MODE_STORAGE_KEY,
  isDisplayMode,
  type DisplayMode,
} from "@/lib/display-mode";

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggleCollapsed: () => {},
  displayMode: "wide",
  setDisplayMode: () => {},
});

export function useSidebarLayout() {
  return useContext(SidebarContext);
}

const LAYOUT_PREFERENCE_EVENT = "app-layout-preference-change";

function subscribeLayoutPreferences(callback: () => void) {
  function handlePreferenceChange() {
    document.documentElement.dataset.displayMode = getDisplayModeSnapshot();
    callback();
  }

  window.addEventListener("storage", handlePreferenceChange);
  window.addEventListener(LAYOUT_PREFERENCE_EVENT, handlePreferenceChange);
  return () => {
    window.removeEventListener("storage", handlePreferenceChange);
    window.removeEventListener(LAYOUT_PREFERENCE_EVENT, handlePreferenceChange);
  };
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem("sidebar-collapsed") === "1";
}

function getDisplayModeSnapshot(): DisplayMode {
  const stored = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
  return isDisplayMode(stored) ? stored : "wide";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeLayoutPreferences, getCollapsedSnapshot, () => false);
  const displayMode = useSyncExternalStore(
    subscribeLayoutPreferences,
    getDisplayModeSnapshot,
    (): DisplayMode => "wide",
  );

  function toggleCollapsed() {
    window.localStorage.setItem("sidebar-collapsed", collapsed ? "0" : "1");
    window.dispatchEvent(new Event(LAYOUT_PREFERENCE_EVENT));
  }

  function setDisplayMode(mode: DisplayMode) {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
    document.documentElement.dataset.displayMode = mode;
    window.dispatchEvent(new Event(LAYOUT_PREFERENCE_EVENT));
  }

  const isAuthRoute =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const isMarketingRoute =
    pathname === "/accueil" ||
    pathname.startsWith("/accueil/") ||
    pathname === "/homepage" ||
    pathname.startsWith("/homepage/");

  if (isAuthRoute || isMarketingRoute) {
    return <div className="relative min-h-screen">{children}</div>;
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, displayMode, setDisplayMode }}>
      <MobileNav />
      <div className={`grid min-h-screen ${collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[248px_1fr]"}`}>
        <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex min-w-0 flex-col bg-[var(--background)]">
          <DesktopTopNav />
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
